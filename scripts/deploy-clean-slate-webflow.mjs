#!/usr/bin/env node
/**
 * Push clean-slate custom code to Webflow via API v2, then optionally publish.
 *
 * Usage:
 *   WEBFLOW_API_TOKEN=xxx node scripts/deploy-clean-slate-webflow.mjs
 *   WEBFLOW_API_TOKEN=xxx node scripts/deploy-clean-slate-webflow.mjs --publish
 *   ...--footer-only   update only the jsDelivr footer tags
 *   ...--head-only     add only the minimal head residue
 *
 * This only touches page head/footer custom code. Designer-first LAYOUT changes
 * (hero figure bleed, funnel padding, threshold copy) are NOT automated here —
 * do those in Designer per webflow/CLEAN-SLATE-DESIGNER-FIRST.md.
 *
 * Page: clean-slate · Site: lowtideflow-co-v2-build
 */

const PAGE_ID = '6a5711c9136987eae97760e3';
const SITE_ID = '6789f449bbb1a21245706751';
const COMMIT = '2047dec';

// Minimal head residue — only what Designer cannot express. Layout is done in
// Designer first (see webflow/CLEAN-SLATE-DESIGNER-FIRST.md). Kept idempotent
// via the sentinel below; never appends the old 95-line block.
const HEAD_SENTINEL = '/* LTF-HEAD-INTEGRATION v1 */';
const HEAD_RESIDUE = `<style>
${HEAD_SENTINEL}
@media (max-width: 991px) {
  .ltf-hero { min-height: var(--ltf-hero-h, calc(100svh + 52px)) !important; }
  .ltf-btn-gradient-wrap.is-hero-cta-wrap {
    bottom: calc(25px + env(safe-area-inset-bottom, 0px)) !important;
  }
  .ltf-funnel-cta-threshold { white-space: nowrap !important; }
}
</style>`;

const TOKEN_ENV_NAMES = ['WEBFLOW_API_TOKEN', 'CURSOR_WEBFLOW_MCP', 'WEBFLOW_TOKEN'];
const tokenName = TOKEN_ENV_NAMES.find((n) => process.env[n]);
const token = tokenName ? process.env[tokenName] : null;
if (!token) {
  console.error(
    `No Webflow token found. Set one of these as a Cursor secret (Value = the token string ` +
      `from Webflow → Site settings → Apps & integrations → API access):\n  ${TOKEN_ENV_NAMES.join(
        '\n  ',
      )}`,
  );
  process.exit(1);
}
console.log(`Using Webflow token from ${tokenName}.`);

const api = (path, opts = {}) =>
  fetch(`https://api.webflow.com/v2${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

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

function ensureHeadResidue(head) {
  if (head.includes(HEAD_SENTINEL)) {
    console.log('Head integration sentinel present — leaving head untouched.');
    return head;
  }
  console.log('Adding minimal head integration residue (3 rules).');
  return `${head.trim()}\n${HEAD_RESIDUE}`;
}

async function main() {
  const res = await api(`/pages/${PAGE_ID}/custom_code`);
  if (!res.ok) {
    console.error('GET custom_code failed:', res.status, await res.text());
    process.exit(1);
  }

  const current = await res.json();
  const headOnly = process.argv.includes('--head-only');
  const footerOnly = process.argv.includes('--footer-only');
  const rawHead = stripHtmlComments(current.head || '');
  const rawBody = stripHtmlComments(current.body || '');
  const head = footerOnly ? rawHead : ensureHeadResidue(rawHead);
  const body = headOnly ? rawBody : replaceJsdelivrFooter(rawBody);

  const put = await api(`/pages/${PAGE_ID}/custom_code`, {
    method: 'PUT',
    body: JSON.stringify({ head, body }),
  });

  if (!put.ok) {
    console.error('PUT custom_code failed:', put.status, await put.text());
    process.exit(1);
  }

  console.log(`Updated clean-slate custom code (pinned @${COMMIT}).`);
  console.log(`  Head: ${footerOnly ? 'untouched (--footer-only)' : 'minimal integration residue ensured'}`);
  console.log(`  Footer: ${headOnly ? 'untouched (--head-only)' : `rock-scene + ltf + hero-viewport @${COMMIT} (deduped)`}`);
  console.log('  NOTE: Designer-first layout changes are NOT automated — see CLEAN-SLATE-DESIGNER-FIRST.md');

  if (process.argv.includes('--publish')) {
    // Publish to the production custom domain(s), not just the webflow.io subdomain.
    let customDomains = [];
    const domRes = await api(`/sites/${SITE_ID}/custom_domains`);
    if (domRes.ok) {
      const dom = await domRes.json();
      const list = dom.customDomains || dom.domains || [];
      customDomains = list.map((d) => ({ id: d.id })).filter((d) => d.id);
      console.log(`Publishing to ${customDomains.length} custom domain(s) + webflow.io subdomain.`);
    } else {
      console.warn('Could not list custom domains:', domRes.status, '— publishing subdomain only.');
    }

    const pub = await api(`/sites/${SITE_ID}/publish`, {
      method: 'POST',
      body: JSON.stringify({
        publishToWebflowSubdomain: true,
        ...(customDomains.length ? { customDomains } : {}),
      }),
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
