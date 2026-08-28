#!/usr/bin/env node
/**
 * Push clean-slate custom code to Webflow via API v2, then optionally publish.
 *
 * Usage:
 *   WEBFLOW_API_TOKEN=xxx node scripts/deploy-clean-slate-webflow.mjs
 *   WEBFLOW_API_TOKEN=xxx node scripts/deploy-clean-slate-webflow.mjs --publish
 *
 * Page: clean-slate · Site: lowtideflow-co-v2-build
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PAGE_ID = '6a5711c9136987eae97760e3';
const SITE_ID = '6789f449bbb1a21245706751';
const COMMIT = '2047dec';
const MOBILE_MARKER = 'bottom: -15px';

const token = process.env.WEBFLOW_API_TOKEN;
if (!token) {
  console.error('Set WEBFLOW_API_TOKEN (Site settings → Apps & integrations → API access).');
  process.exit(1);
}

const api = (path, opts = {}) =>
  fetch(`https://api.webflow.com/v2${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

function readWebflowSnippet(name) {
  const raw = readFileSync(join(ROOT, 'webflow', name), 'utf8');
  return raw.replace(/^<!--[\s\S]*?-->\s*/m, '').trim();
}

function stripHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function replaceJsdelivrFooter(body) {
  const footerDeploy = readWebflowSnippet('clean-slate-page-footer-deploy.html');
  const acuminStart = body.indexOf('<!--\n  LTF site-wide footer');
  const jsdelivrStart = body.search(
    /<script src="https:\/\/cdn\.jsdelivr\.net\/gh\/Staylow-flow\/lowtideflow-assets@/,
  );

  if (acuminStart !== -1 && jsdelivrStart !== -1) {
    return body.slice(0, acuminStart) + footerDeploy;
  }

  if (jsdelivrStart !== -1) {
    return body.slice(0, jsdelivrStart) + footerDeploy;
  }

  return `${body.trim()}\n${footerDeploy}`;
}

function appendMobileHead(head) {
  if (head.includes(MOBILE_MARKER)) {
    console.log('Head already contains mobile fixes — skipping append.');
    return head;
  }
  const mobile = readWebflowSnippet('clean-slate-head-mobile-append.html');
  return `${head.trim()}\n${mobile}`;
}

async function main() {
  const res = await api(`/pages/${PAGE_ID}/custom_code`);
  if (!res.ok) {
    console.error('GET custom_code failed:', res.status, await res.text());
    process.exit(1);
  }

  const current = await res.json();
  const head = appendMobileHead(stripHtmlComments(current.head || ''));
  const body = replaceJsdelivrFooter(stripHtmlComments(current.body || ''));

  const put = await api(`/pages/${PAGE_ID}/custom_code`, {
    method: 'PUT',
    body: JSON.stringify({ head, body }),
  });

  if (!put.ok) {
    console.error('PUT custom_code failed:', put.status, await put.text());
    process.exit(1);
  }

  console.log(`Updated clean-slate custom code (pinned @${COMMIT}).`);
  console.log('  Head: mobile CSS appended if missing');
  console.log('  Footer: rock-scene + ltf + hero-viewport (no duplicates, no page nav.js)');

  if (process.argv.includes('--publish')) {
    const pub = await api(`/sites/${SITE_ID}/publish`, {
      method: 'POST',
      body: JSON.stringify({ publishToWebflowSubdomain: true }),
    });
    if (!pub.ok) {
      console.error('Publish failed:', pub.status, await pub.text());
      process.exit(1);
    }
    console.log('Published site.');
  } else {
    console.log('Publish from Webflow Designer when ready (or re-run with --publish).');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
