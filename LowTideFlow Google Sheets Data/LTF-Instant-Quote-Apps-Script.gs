/**
 * LowTideFlow Instant Quote — Google Apps Script Web App
 *
 * SETUP
 * 1. Open your Master Google Sheet → Extensions → Apps Script
 * 2. Paste this entire file (replace Code.gs)
 * 3. Set CONFIG.DRIVE_FOLDER_ID to your artwork parent folder ID
 * 4. Set CONFIG.SHEET_NAME to the tab name (default "Leads")
 * 5. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the /exec URL into IQ FORM_CONFIG.webhookUrl (already wired in site JS)
 *
 * Columns A–X must match the Instant Quote sheet layout.
 */

var CONFIG = {
  SHEET_NAME: 'Leads',
  /** Parent Drive folder for per-submission artwork folders */
  DRIVE_FOLDER_ID: 'REPLACE_WITH_ARTWORK_PARENT_FOLDER_ID',
  /** First Submission ID number if sheet is empty */
  ID_START: 1001,
  ID_PREFIX: 'LTF-',
  FROM_NAME: 'Low Tide Flow',
  REPLY_TO: 'hello@lowtideflow.co'
};

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return json_({ ok: false, error: 'Busy — try again' });
  }

  try {
    var p = parsePayload_(e);
    var sheet = getSheet_();
    var targetRow = nextEmptyRowInColumnA_(sheet);
    var jobId = nextJobId_(sheet);

    var artUrl = '';
    try {
      artUrl = uploadArtwork_(e, jobId, p);
    } catch (artErr) {
      artUrl = '';
    }
    p.art_url = artUrl || p.art_url || '';

    var internalNotes = '';
    if (p._parse_error) {
      internalNotes = 'PARSE: ' + p._parse_error + (p._raw_preview ? ' | ' + p._raw_preview : '');
    }
    if (p.art_note) {
      internalNotes = (internalNotes ? internalNotes + ' | ' : '') + p.art_note;
    }

    var rowData = [
      jobId, // A Order ID
      new Date(), // B Submission Date
      'HOT', // C Priority
      'NEW', // D Lead Status
      p.client_name || '', // E Client Name
      p.company_name || '', // F Company Name
      p.email || '', // G Email Address
      p.phone || '', // H Phone Number
      p.quoted_estimate || '', // I Quote Form Estimate
      p.project_notes || '', // J Project Notes
      p.apparel_style || '', // K Apparel Style
      p.ink_colors || '', // L Ink Colors
      p.print_locations || '', // M Print Locations
      p.final_quantity || '', // N Final Quantity
      p.split_apparel_style || '', // O Split - Apparel Style
      p.split_ink_colors || '', // P Split - Ink Colors
      p.split_print_locations || '', // Q Split - Print Locations
      p.split_final_quantity || '', // R Split - Final Quantity
      p.art_url || '', // S Art Upload File
      false, // T Auto-Email Sent?
      p.timeline || '', // U Timeline
      false, // V Email Confirmation Sent
      'PENDING', // W Email Status
      internalNotes // X Internal Notes
    ];

    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);

    try {
      if (!p.email) {
        sheet.getRange(targetRow, 23).setValue('SKIPPED: no email in payload');
        sheet.getRange(targetRow, 23).setBackground('#fff2cc');
      } else {
        sendConfirmation_(p, jobId);
        sheet.getRange(targetRow, 20).setValue(true); // T Auto-Email Sent?
        sheet.getRange(targetRow, 22).setValue(true); // V Email Confirmation Sent
        sheet.getRange(targetRow, 23).setValue('SUCCESS'); // W Email Status
        sheet.getRange(targetRow, 23).setBackground(null);
      }
    } catch (mailErr) {
      sheet.getRange(targetRow, 20).setValue(false);
      sheet.getRange(targetRow, 22).setValue(false);
      sheet.getRange(targetRow, 23).setValue('FAILED: ' + String(mailErr));
      sheet.getRange(targetRow, 23).setBackground('#f4cccc');
    }

    return json_({ ok: true, jobId: jobId, row: targetRow, art_url: p.art_url });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput('LTF Instant Quote endpoint OK').setMimeType(
    ContentService.MimeType.TEXT
  );
}

/* ── helpers ─────────────────────────────────────────────────────────── */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.getSheets()[0];
  return sheet;
}

/** First empty cell scanning Column A upward from bottom. */
function nextEmptyRowInColumnA_(sheet) {
  var last = sheet.getLastRow();
  if (last < 1) return 2;
  var values = sheet.getRange(1, 1, last, 1).getValues();
  for (var r = values.length - 1; r >= 0; r--) {
    if (String(values[r][0] || '').trim() !== '') {
      return r + 2; // next row after last filled A
    }
  }
  return 2;
}

function nextJobId_(sheet) {
  var last = sheet.getLastRow();
  var maxNum = CONFIG.ID_START - 1;
  if (last >= 2) {
    var ids = sheet.getRange(2, 1, last, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var m = String(ids[i][0] || '').match(/(\d+)\s*$/);
      if (m) {
        var n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
  }
  return CONFIG.ID_PREFIX + String(maxNum + 1);
}

function parsePayload_(e) {
  var raw = '';
  try {
    if (e && e.parameter && e.parameter.payload) {
      raw = e.parameter.payload;
    } else if (e && e.parameters && e.parameters.payload && e.parameters.payload[0]) {
      raw = e.parameters.payload[0];
    } else if (e && e.postData && e.postData.contents) {
      var contents = e.postData.contents;
      var type = (e.postData.type || '').toLowerCase();
      if (type.indexOf('application/json') >= 0 || type.indexOf('text/plain') >= 0) {
        raw = contents;
      } else if (type.indexOf('application/x-www-form-urlencoded') >= 0) {
        var m = String(contents).match(/(?:^|&)payload=([^&]*)/);
        raw = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : contents;
      } else {
        // multipart or unknown — try payload= scrape, else whole body
        var m2 = String(contents).match(/name="payload"[\s\S]*?\r?\n\r?\n([\s\S]*?)\r?\n--/);
        raw = m2 ? m2[1] : contents;
      }
    }
  } catch (parseErr) {
    raw = '';
  }

  if (!raw) return { _parse_error: 'empty payload' };

  var data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (jsonErr) {
    return { _parse_error: 'bad json', _raw_preview: String(raw).slice(0, 500) };
  }

  // Accept nested { sheet: {...} } or flat p fields
  if (data.sheet) return data.sheet;
  if (data.contact) {
    return {
      client_name: (data.contact && data.contact.fullName) || '',
      company_name: (data.contact && data.contact.companyName) || '',
      email: (data.contact && data.contact.email) || '',
      phone: (data.contact && data.contact.phone) || '',
      project_notes: data.projectNotes || '',
      quoted_estimate: (data.quote && data.quote.totalEstimate) || '',
      apparel_style: (data.quote && data.quote.styleRow1) || '',
      ink_colors: data.quote && data.quote.inkColors,
      print_locations: data.quote && data.quote.printLocations,
      final_quantity: data.quote && data.quote.quantity,
      split_apparel_style: (data.quote && data.quote.styleRow2) || '',
      split_ink_colors: data.quote && data.quote.split ? data.quote.inkColors : '',
      split_print_locations: data.quote && data.quote.split ? data.quote.printLocations : '',
      split_final_quantity:
        data.quote && data.quote.split ? Math.round(data.quote.quantity / 2) : '',
      art_url: '',
      timeline: '',
      art_file_names: data.artworkFileNames || []
    };
  }
  return data;
}

function uploadArtwork_(e, jobId, p) {
  if (!CONFIG.DRIVE_FOLDER_ID || CONFIG.DRIVE_FOLDER_ID.indexOf('REPLACE') === 0) {
    return '';
  }

  var blobs = collectArtworkBlobs_(e, p);
  if (!blobs.length) return '';

  var parent = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  var safeName =
    String(p.client_name || 'Client')
      .replace(/[^\w\s\-]/g, '')
      .trim()
      .slice(0, 40) || 'Client';
  var folder = parent.createFolder(
    jobId +
      '_' +
      safeName +
      '_' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
  );

  blobs.forEach(function (blob) {
    if (blob) folder.createFile(blob);
  });

  try {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shareErr) {}

  return folder.getUrl();
}

/**
 * Build Drive blobs from the submission. Preferred path: base64 files carried in
 * the JSON payload (p.art_files = [{ name, mimeType, data }]). Legacy fallback:
 * raw multipart parts (e.files.artwork_N) from older form builds.
 */
function collectArtworkBlobs_(e, p) {
  var blobs = [];

  var arr = (p && p.art_files) || [];
  if (arr && arr.length) {
    for (var i = 0; i < arr.length; i++) {
      var f = arr[i];
      if (!f || !f.data) continue;
      try {
        var bytes = Utilities.base64Decode(f.data);
        var blob = Utilities.newBlob(
          bytes,
          f.mimeType || 'application/octet-stream',
          f.name || 'artwork_' + (i + 1)
        );
        blobs.push(blob);
      } catch (decErr) {
        // Skip a single bad file rather than failing the whole upload.
      }
    }
    if (blobs.length) return blobs;
  }

  if (e && e.files) {
    var keys = Object.keys(e.files).filter(function (k) {
      return k.indexOf('artwork_') === 0;
    });
    keys.forEach(function (key) {
      var b = e.files[key];
      if (b) blobs.push(b);
    });
  }

  return blobs;
}

function sendConfirmation_(p, jobId) {
  var to = p.email;
  if (!to) throw new Error('No email');

  var subject = 'We received your Low Tide Flow quote request (' + jobId + ')';
  var body =
    'Hi ' +
    (p.client_name || 'there') +
    ',\n\n' +
    'Thanks for submitting your Instant Quote project brief. We logged it as ' +
    jobId +
    '.\n\n' +
    'Style: ' +
    (p.apparel_style || '—') +
    '\n' +
    'Qty: ' +
    (p.final_quantity || '—') +
    '\n' +
    'Ink / Locations: ' +
    (p.ink_colors || '—') +
    ' / ' +
    (p.print_locations || '—') +
    '\n\n' +
    'Our team will review artwork + pricing and follow up shortly.\n\n' +
    '— Low Tide Flow\n';

  GmailApp.sendEmail(to, subject, body, {
    name: CONFIG.FROM_NAME,
    replyTo: CONFIG.REPLY_TO
  });
}
