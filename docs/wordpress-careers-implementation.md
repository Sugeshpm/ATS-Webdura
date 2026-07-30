# WordPress Careers Page → Webdura ATS — Implementation Guide

This is the complete recipe for making your existing WordPress careers form
(the one in the screenshot: Name / Email / Phone / Job Title / Years of Experience /
LinkedIn / Message / Resume) push submissions directly into the ATS.

## 1. Get your API credentials (one-time, on the ATS side)

You need two values that go into WordPress: an **API key** (public identifier) and
an **API secret** (used to sign each request). Both are stored in your Supabase
project's `public_intake_credentials` table.

### Provision them in the Supabase SQL editor

```sql
-- Look up your tenant id first
select id from public.tenants;
--   → 12345678-abcd-…    (copy this)

-- Find the "Telecallers" job's id so we can use it as the default when the
-- WP form's job_title doesn't match anything else.
select id, title from public.jobs where status = 'active' order by title;
--   → find the row for the job you'll link the form to; copy its id.

-- Now create the credential. Replace the two placeholders.
insert into public.public_intake_credentials
  (tenant_id, name, api_key, api_secret_encrypted, default_job_id, allowed_origins)
values (
  '<your-tenant-uuid>',
  'Webdura WP Careers',
  'wp_' || encode(gen_random_bytes(16), 'hex'),
  '',                                              -- fill via the encrypt helper below
  '<your-default-job-uuid or null>',
  array['https://webdura.in', 'https://www.webdura.in']
)
returning api_key;
```

The `api_key` you just generated is your **public identifier** — WordPress will
send it in a header. Copy it.

### Generate the API secret

The **secret** must be stored in the DB encrypted with your `META_ENCRYPTION_KEY`.
Easiest is a one-off Node script:

```js
// scripts/encrypt-intake-secret.mjs
import { readFileSync } from "node:fs";
import { createCipheriv, randomBytes } from "node:crypto";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).map(l => l.split("=")).filter(a => a.length === 2)
);
const key = Buffer.from(env.META_ENCRYPTION_KEY, "hex");
const secret = process.argv[2];
const iv = randomBytes(12);
const c = createCipheriv("aes-256-gcm", key, iv);
const ct = Buffer.concat([c.update(secret, "utf8"), c.final()]);
console.log("Store in DB:  ", Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64"));
console.log("Give to WP:   ", secret);
```

Run it locally in the ATS project directory:

```
node scripts/encrypt-intake-secret.mjs "$(openssl rand -hex 32)"
```

You get two strings:
- **"Store in DB"** — a base64 blob. Copy into the `api_secret_encrypted` column:

```sql
update public.public_intake_credentials
   set api_secret_encrypted = '<the base64 blob>'
 where api_key = '<the wp_… key from earlier>';
```

- **"Give to WP"** — the plaintext secret. Save this — WordPress needs it.

## 2. Add the constants to WordPress

Open `wp-config.php` (or a small custom must-use plugin — anywhere private that
loads before your theme). Add:

```php
define('WEBDURA_HRM_ENDPOINT', 'https://hiring.webdura.in/api/public/applications');
define('WEBDURA_HRM_API_KEY',   'wp_xxxxxxxxxxxxxxxx');           // the api_key you generated
define('WEBDURA_HRM_API_SECRET','the-plaintext-secret');           // "Give to WP" from step 1
// Optional — leave empty to skip captcha:
define('WEBDURA_RECAPTCHA_SITE_KEY', '');
define('WEBDURA_RECAPTCHA_SECRET',   '');
```

**Do NOT put these in a theme file that gets committed to a public repo** — they're secrets.

## 3. Add the handler to WordPress

The complete drop-in PHP snippet is in this repo at
`docs/wordpress-careers-snippet.php` — copy its full contents into your theme's
`functions.php` (or an mu-plugin).

The snippet includes:

- A `[webdura_careers_form]` shortcode (renders the form)
- An `admin-ajax` handler that signs the payload and forwards it to the ATS
- A retry queue for 5xx failures (WP-Cron based, 6 attempts before giving up)

### Adapting the snippet to YOUR existing form

Your existing form already has its own HTML on the WordPress site. You don't
need our shortcode — you just need the **AJAX handler** to receive submissions
from your form and forward them to the ATS. Here's the minimal version tuned to
your exact field set (Name, Email, Phone, Job Title, Years of Experience,
LinkedIn profile, Message, Resume):

```php
add_action('wp_ajax_nopriv_webdura_careers_submit', 'webdura_careers_submit_handler');
add_action('wp_ajax_webdura_careers_submit',        'webdura_careers_submit_handler');

function webdura_careers_submit_handler() {
    // 1. Nonce (recommended if your form emits one)
    if (isset($_POST['_wpnonce']) &&
        !check_ajax_referer('webdura_careers_submit', '_wpnonce', false)) {
        wp_send_json(['ok' => false, 'error' => 'Session expired. Refresh and try again.'], 400);
    }

    foreach (['WEBDURA_HRM_ENDPOINT', 'WEBDURA_HRM_API_KEY', 'WEBDURA_HRM_API_SECRET'] as $c) {
        if (!defined($c) || !constant($c)) {
            wp_send_json(['ok' => false, 'error' => 'HRM integration not configured.'], 500);
        }
    }

    // 2. Collect and normalise fields — names must match YOUR form's <input name=…>
    $full_name  = trim($_POST['name']            ?? '');   // "Name"
    $email      = strtolower(trim($_POST['email'] ?? ''));
    $phone      = trim($_POST['phone']           ?? '');
    $job_title  = trim($_POST['job_title']       ?? '');   // "Job Title"
    $exp_years  = trim($_POST['experience']      ?? '');   // "Years of Experience"
    $linkedin   = trim($_POST['linkedin']        ?? '');   // "LinkedIn profile"
    $message    = trim($_POST['message']         ?? '');   // "Message"
    $honeypot   = trim($_POST['website_url']     ?? '');   // hidden input, must stay empty

    if ($honeypot !== '') {
        wp_send_json(['ok' => false, 'error' => 'Submission blocked.'], 400);
    }

    // 3. Resume file validation
    if (empty($_FILES['resume']) || ($_FILES['resume']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        wp_send_json(['ok' => false, 'error' => 'Resume file is required.'], 400);
    }
    $size = intval($_FILES['resume']['size']);
    if ($size <= 0 || $size > 10 * 1024 * 1024) {
        wp_send_json(['ok' => false, 'error' => 'Resume must be a non-empty file up to 10 MB.'], 400);
    }
    $ext = strtolower(pathinfo($_FILES['resume']['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['pdf', 'doc', 'docx'], true)) {
        wp_send_json(['ok' => false, 'error' => 'Resume must be a PDF, DOC, or DOCX file.'], 400);
    }

    // 4. Sign the payload
    $api_key = WEBDURA_HRM_API_KEY;
    $secret  = WEBDURA_HRM_API_SECRET;
    $idem    = function_exists('wp_generate_uuid4') ? wp_generate_uuid4() : bin2hex(random_bytes(16));
    $ts      = time();

    // Canonical string exactly matches the server's HMAC input:
    //   v1:{timestamp}:{api_key}:{idempotency}:{email_lower}:{job_title_lower}
    $canonical = implode(':', ['v1', $ts, $api_key, $idem, $email, strtolower($job_title)]);
    $signature = hash_hmac('sha256', $canonical, $secret);

    // 5. Forward to the ATS via multipart/form-data
    $ch = curl_init(WEBDURA_HRM_ENDPOINT);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_HTTPHEADER     => [
            'X-Webdura-Api-Key: '     . $api_key,
            'X-Webdura-Signature: t=' . $ts . ',v1=' . $signature,
            'X-Webdura-Idempotency: ' . $idem,
            'X-Webdura-Origin: '      . (isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : home_url())
        ],
        CURLOPT_POSTFIELDS     => [
            'full_name'         => $full_name,
            'email'             => $email,
            'phone'             => $phone,
            'job_title'         => $job_title,
            'experience_years'  => $exp_years,
            'linkedin_url'      => $linkedin,      // NEW field
            'message'           => $message,       // NEW field
            'source'            => 'wordpress_careers',
            'resume'            => new CURLFile(
                $_FILES['resume']['tmp_name'],
                $_FILES['resume']['type'] ?: 'application/octet-stream',
                $_FILES['resume']['name']
            )
        ]
    ]);
    $body = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // 6. Pass response through
    if ($body === false || $http >= 500) {
        wp_send_json([
            'ok'    => false,
            'error' => 'We received your application but couldn\'t deliver it yet. Please try again in a few minutes.'
        ], 502);
    }

    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        wp_send_json(['ok' => false, 'error' => 'Unexpected response from HRM.'], 502);
    }
    wp_send_json($decoded, $http);
}
```

**Important:** the field names on the right side of `$_POST['name']`,
`$_POST['email']`, etc. must **match the `name=…` attributes of your existing
form's inputs**. If your form has `<input name="applicant_name">` instead of
`<input name="name">`, change the `$_POST['name']` above to `$_POST['applicant_name']`.

## 4. Wire your form's Submit button to the AJAX endpoint

Your existing form is likely rendered by a plugin (Contact Form 7, WPForms, Elementor
Forms, Fluent Forms, or a custom PHP form). Pick the option that matches:

### Option A — plain HTML form (custom PHP theme code)

Just add these two attributes to your `<form>` tag:

```html
<form
  method="POST"
  action="/wp-admin/admin-ajax.php"
  enctype="multipart/form-data"
  onsubmit="return webduraCareersSubmit(this, event);"
>
  <input type="hidden" name="action" value="webdura_careers_submit">
  <input type="hidden" name="_wpnonce" value="<?php echo wp_create_nonce('webdura_careers_submit'); ?>">
  <!-- your existing fields here -->
</form>

<script>
async function webduraCareersSubmit(form, e) {
  e.preventDefault();
  const fd  = new FormData(form);
  const res = await fetch(form.action, { method: 'POST', body: fd, credentials: 'same-origin' });
  const data = await res.json();
  if (res.ok && data.ok) {
    window.location.assign('/careers/thank-you?ref=' + encodeURIComponent(data.reference || ''));
  } else {
    alert(data.error || 'Submission failed. Please try again.');
  }
  return false;
}
</script>
```

### Option B — Contact Form 7 (CF7)

CF7 has its own submission flow. Hook into `wpcf7_before_send_mail` and forward
the data yourself:

```php
add_action('wpcf7_before_send_mail', function ($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    if (!$submission) return;
    $posted = $submission->get_posted_data();

    // Map CF7 field names → the format webdura_careers_submit_handler expects
    $_POST['name']       = $posted['your-name']     ?? '';
    $_POST['email']      = $posted['your-email']    ?? '';
    $_POST['phone']      = $posted['your-phone']    ?? '';
    $_POST['job_title']  = $posted['job-title']     ?? '';
    $_POST['experience'] = $posted['experience']    ?? '';
    $_POST['linkedin']   = $posted['linkedin']      ?? '';
    $_POST['message']    = $posted['message']       ?? '';

    // CF7's uploaded files
    $files = $submission->uploaded_files();
    if (!empty($files['resume'])) {
        $_FILES['resume'] = [
            'name'     => basename($files['resume'][0]),
            'type'     => mime_content_type($files['resume'][0]),
            'tmp_name' => $files['resume'][0],
            'error'    => 0,
            'size'     => filesize($files['resume'][0])
        ];
    }

    // Fire the handler — but capture its wp_send_json() output so CF7 doesn't die
    ob_start();
    webdura_careers_submit_handler();
    ob_end_clean();
});
```

Change the CF7 field names (`your-name`, `your-email`, etc.) to match what your
CF7 form actually uses.

### Option C — WPForms / Elementor Forms / Fluent Forms

Each of these has a "Webhook" or "Custom Action" feature. Point it at the
WordPress admin-ajax URL (`/wp-admin/admin-ajax.php`) with these fields:

- `action` (fixed value): `webdura_careers_submit`
- Then map your form fields to the field names the handler expects: `name`,
  `email`, `phone`, `job_title`, `experience`, `linkedin`, `message`, `resume`.

## 5. Verify end-to-end

1. Open your career page in an incognito window.
2. Submit a test application (real-looking data, dummy resume).
3. Watch for:
   - Immediate: redirect to `/careers/thank-you` (or your equivalent success page).
   - ~2s later: the candidate + application appear in the ATS **Candidates** list under the mapped job. The job link on the sidebar shows `+1`.
   - The candidate detail page shows Name, Email, Phone, Experience, LinkedIn URL, and — if you supplied a Message — the message on the application.
4. Try re-submitting the same form (before closing the tab). You should be treated as a duplicate (no second candidate created) — that's the idempotency guard.

## 6. Troubleshooting

| Symptom (what WP shows or logs) | Likely cause | Fix |
| --- | --- | --- |
| `HRM integration not configured` | Constants missing in `wp-config.php` | Re-check step 2 |
| ATS returns `401 invalid_api_key` | API key doesn't match a row in `public_intake_credentials`, or the row is inactive/revoked | Re-check the value in WP against the DB row |
| ATS returns `401 bad_signature` | The plaintext secret in WP doesn't match the one you encrypted for the DB | Re-run the encrypt script; make sure you saved the same secret in both places |
| ATS returns `403 origin_not_allowed` | Your WP domain isn't in the credential's `allowed_origins` array | Update: `update public_intake_credentials set allowed_origins = allowed_origins '{https://your-domain}' where api_key = '…';` |
| ATS returns `422 intake_failed: No job matches …` | The `job_title` field value doesn't match any active job's title, and no `default_job_id` is set on the credential | Set a default job on the credential (see step 1), or ensure the WP form's job title text exactly matches an ATS job title |
| Curl `HTTP 0` / timeout | WP server can't reach `hiring.webdura.in` (firewall / DNS) | Check outbound HTTPS from the WP host |
| Submissions appear in the ATS but resume is missing | The `$_FILES['resume']` array wasn't populated — check the form's `enctype="multipart/form-data"` and the field's `name` attribute |

## 7. Security notes

- **Never commit** `wp-config.php` or any file containing `WEBDURA_HRM_API_SECRET`.
- The **secret** is what proves it's really your WordPress site sending the request. If it ever leaks, generate a new secret + re-encrypt for the DB + update WP.
- The API enforces:
  - Rate limit — 5 submissions per IP per 10 minutes (blocks spam)
  - Honeypot field — bots that fill `<input name="website_url">` are silently rejected
  - Optional reCAPTCHA v3 or Cloudflare Turnstile (auto-detected if configured)
  - Origin allowlist — request must come from a WP domain you listed
  - HMAC signature — request must be signed with your secret
- All resume files are scanned for MIME type + size and rejected if larger than 10 MB.

## 8. Reference: full API spec

For every field, header, error code, and canonical signature format, see
`docs/PUBLIC_INTAKE_API.md`.

## Recap

| What you need | Where to put it |
| --- | --- |
| API endpoint URL | WordPress constant `WEBDURA_HRM_ENDPOINT` |
| API key | WordPress constant `WEBDURA_HRM_API_KEY` |
| API secret | WordPress constant `WEBDURA_HRM_API_SECRET` |
| PHP handler | Theme `functions.php` (or an mu-plugin) |
| Form wiring | Point your existing form's Submit action at the handler (see step 4) |
