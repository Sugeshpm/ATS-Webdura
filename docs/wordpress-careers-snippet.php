<?php
/**
 * Webdura HRM careers-form bridge — drop into functions.php or an mu-plugin.
 * Renders a [webdura_careers_form] shortcode, handles the AJAX submit,
 * signs and forwards the payload to the HRM public intake endpoint.
 *
 * Config: set these 5 constants BEFORE the file loads (wp-config.php is best):
 *   define('WEBDURA_HRM_ENDPOINT', 'https://ats-webdura.vercel.app/api/public/applications');
 *   define('WEBDURA_HRM_API_KEY', 'wp_xxxxxxxxxxxxxxxx');
 *   define('WEBDURA_HRM_API_SECRET', 'the-plaintext-secret-you-encrypted-for-supabase');
 *   define('WEBDURA_RECAPTCHA_SITE_KEY', '6Lc...');   // optional; leave empty to disable
 *   define('WEBDURA_RECAPTCHA_SECRET',   '6Lc...');   // optional; used server-side, kept out of the browser
 *
 * Never edit those directly in a theme file that ships publicly — put them in
 * wp-config.php or a private plugin so they don't end up in git.
 */

if (!defined('ABSPATH')) exit;

// ---------------------------------------------------------------------------
// 1. Shortcode: [webdura_careers_form job="Senior Content Writer"]
// ---------------------------------------------------------------------------
add_shortcode('webdura_careers_form', function ($atts) {
    $atts = shortcode_atts(['job' => ''], $atts);
    $job = esc_attr($atts['job']);
    $ajax = esc_url(admin_url('admin-ajax.php'));
    $nonce = wp_create_nonce('webdura_careers_submit');
    $recaptcha_key = defined('WEBDURA_RECAPTCHA_SITE_KEY') ? WEBDURA_RECAPTCHA_SITE_KEY : '';

    ob_start(); ?>
    <form id="webdura-careers-form" enctype="multipart/form-data" novalidate>
      <input type="hidden" name="action" value="webdura_careers_submit">
      <input type="hidden" name="_wpnonce" value="<?php echo esc_attr($nonce); ?>">
      <input type="hidden" name="job_title" value="<?php echo $job; ?>">
      <!-- Honeypot: real users leave this empty; bots fill everything -->
      <input type="text" name="website_url" tabindex="-1" autocomplete="off" style="position:absolute;left:-5000px;height:0;width:0;opacity:0" aria-hidden="true">

      <label>Full Name<input type="text" name="full_name" required maxlength="120"></label>
      <label>Email<input type="email" name="email" required maxlength="180"></label>
      <label>Phone<input type="tel" name="phone" required pattern="^[+\d][\d\s\-()]{6,20}$"></label>
      <label>Years of Experience<input type="number" name="experience_years" min="0" max="60" step="1" required></label>
      <?php if (!$job): ?>
      <label>Position Applied For<input type="text" name="job_title" required maxlength="120"></label>
      <?php endif; ?>
      <label>Resume (PDF/DOC/DOCX, max 10&nbsp;MB)
        <input type="file" name="resume" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required>
      </label>

      <?php if ($recaptcha_key): ?>
      <input type="hidden" name="captcha_token" value="">
      <?php endif; ?>

      <button type="submit">Submit Application</button>
      <p class="wcf-status" role="status" aria-live="polite"></p>
    </form>

    <?php if ($recaptcha_key): ?>
    <script src="https://www.google.com/recaptcha/api.js?render=<?php echo esc_attr($recaptcha_key); ?>"></script>
    <?php endif; ?>

    <script>
    (function () {
      var form   = document.getElementById('webdura-careers-form');
      if (!form) return;
      var btn    = form.querySelector('button[type=submit]');
      var status = form.querySelector('.wcf-status');
      var recaptchaKey = <?php echo json_encode($recaptcha_key); ?>;

      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (btn.disabled) return;
        btn.disabled = true;
        status.textContent = 'Submitting…';

        try {
          if (recaptchaKey && typeof grecaptcha !== 'undefined') {
            await new Promise(function (r) { grecaptcha.ready(r); });
            var token = await grecaptcha.execute(recaptchaKey, { action: 'careers_submit' });
            form.elements['captcha_token'].value = token;
          }

          var fd = new FormData(form);
          var res = await fetch(<?php echo json_encode($ajax); ?>, { method: 'POST', body: fd, credentials: 'same-origin' });
          var data = await res.json();

          if (res.ok && data && data.ok) {
            var ref = data.reference ? '?ref=' + encodeURIComponent(data.reference) : '';
            window.location.assign('/careers/thank-you/' + ref);
            return;
          }

          // Field-level errors
          if (data && data.fields) {
            status.textContent = Object.values(data.fields).join(' ');
          } else {
            status.textContent = (data && data.error) || 'Submission failed. Please try again.';
          }
        } catch (err) {
          status.textContent = 'Network error. Please try again in a moment.';
          console.error('[webdura careers]', err);
        } finally {
          btn.disabled = false;
        }
      });
    })();
    </script>
    <?php
    return ob_get_clean();
});

// ---------------------------------------------------------------------------
// 2. AJAX handler — signs the payload and proxies it to the HRM
//    (fronting the HRM through admin-ajax lets us keep the api_secret off the
//    browser and verify the WP nonce before we spend a call.)
// ---------------------------------------------------------------------------
add_action('wp_ajax_nopriv_webdura_careers_submit', 'webdura_careers_submit_handler');
add_action('wp_ajax_webdura_careers_submit',        'webdura_careers_submit_handler');

function webdura_careers_submit_handler() {
    // 2a. Nonce check
    if (!check_ajax_referer('webdura_careers_submit', '_wpnonce', false)) {
        wp_send_json(['ok' => false, 'error' => 'Session expired. Refresh and try again.'], 400);
    }

    // 2b. Required constants
    foreach (['WEBDURA_HRM_ENDPOINT', 'WEBDURA_HRM_API_KEY', 'WEBDURA_HRM_API_SECRET'] as $c) {
        if (!defined($c) || !constant($c)) {
            wp_send_json(['ok' => false, 'error' => 'HRM integration not configured on the server.'], 500);
        }
    }

    // 2c. Collect + normalise fields
    $email      = strtolower(trim($_POST['email'] ?? ''));
    $job_title  = trim($_POST['job_title'] ?? '');
    $full_name  = trim($_POST['full_name'] ?? '');
    $phone      = trim($_POST['phone'] ?? '');
    $exp_years  = trim($_POST['experience_years'] ?? '');
    $captcha    = trim($_POST['captcha_token'] ?? '');
    $honeypot   = trim($_POST['website_url'] ?? '');

    if ($honeypot !== '') { wp_send_json(['ok' => false, 'error' => 'Submission blocked.'], 400); }

    // 2d. File upload
    if (empty($_FILES['resume']) || ($_FILES['resume']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        wp_send_json(['ok' => false, 'error' => 'Resume file is required.'], 400);
    }
    $resume_size = intval($_FILES['resume']['size']);
    if ($resume_size <= 0 || $resume_size > 10 * 1024 * 1024) {
        wp_send_json(['ok' => false, 'error' => 'Resume must be a non-empty file up to 10 MB.'], 400);
    }
    $ext = strtolower(pathinfo($_FILES['resume']['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['pdf', 'doc', 'docx', 'rtf', 'txt'], true)) {
        wp_send_json(['ok' => false, 'error' => 'Resume must be a PDF, DOC, DOCX, RTF, or TXT file.'], 400);
    }

    // 2e. Sign
    $api_key = WEBDURA_HRM_API_KEY;
    $secret  = WEBDURA_HRM_API_SECRET;
    // wp_generate_uuid4() is available in modern WP; falls back to raw random.
    $idem = function_exists('wp_generate_uuid4') ? wp_generate_uuid4()
          : bin2hex(random_bytes(16));
    $ts   = time();

    $canonical = implode(':', ['v1', $ts, $api_key, $idem, $email, strtolower($job_title)]);
    $signature = hash_hmac('sha256', $canonical, $secret);

    // 2f. Build multipart body for cURL. wp_remote_post cannot cleanly forward a
    //     file, so we use PHP's native curl.
    $ch = curl_init(WEBDURA_HRM_ENDPOINT);
    curl_setopt_array($ch, [
        CURLOPT_POST            => true,
        CURLOPT_RETURNTRANSFER  => true,
        CURLOPT_TIMEOUT         => 30,
        CURLOPT_CONNECTTIMEOUT  => 8,
        CURLOPT_HTTPHEADER      => [
            'X-Webdura-Api-Key: ' . $api_key,
            'X-Webdura-Signature: t=' . $ts . ',v1=' . $signature,
            'X-Webdura-Idempotency: ' . $idem,
            'X-Webdura-Origin: ' . (isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : home_url())
        ],
        CURLOPT_POSTFIELDS      => [
            'full_name'        => $full_name,
            'email'            => $email,
            'phone'            => $phone,
            'experience_years' => $exp_years,
            'job_title'        => $job_title,
            'captcha_token'    => $captcha,
            'source'           => 'wordpress_careers',
            'resume'           => new CURLFile(
                $_FILES['resume']['tmp_name'],
                $_FILES['resume']['type'] ?: 'application/octet-stream',
                $_FILES['resume']['name']
            )
        ]
    ]);

    $body = curl_exec($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    // 2g. Handle transport error → queue for retry, tell the user we saved it
    if ($body === false || $http >= 500) {
        webdura_careers_queue_retry($_POST, $_FILES, $err ?: "HTTP $http");
        wp_send_json([
            'ok'    => false,
            'error' => 'We received your application but couldn\'t deliver it yet. Our team has been notified and will contact you shortly.',
            'queued'=> true
        ], 202);
    }

    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        error_log('[webdura careers] non-JSON response from HRM: ' . substr($body, 0, 500));
        wp_send_json(['ok' => false, 'error' => 'Unexpected response from HRM.'], 502);
    }

    // 2h. Passthrough — WP responds with whatever the HRM said, keeping the same status code.
    wp_send_json($decoded, $http);
}

// ---------------------------------------------------------------------------
// 3. Retry queue (5xx / network failures)
// ---------------------------------------------------------------------------
function webdura_careers_queue_retry($post, $files, $error) {
    $upload = wp_upload_dir();
    $queue_dir = trailingslashit($upload['basedir']) . 'webdura-careers-queue';
    if (!file_exists($queue_dir)) wp_mkdir_p($queue_dir);
    $id = wp_generate_uuid4();

    // Move the resume out of the PHP tmp dir before it's cleaned up
    $resume_path = trailingslashit($queue_dir) . $id . '-' . sanitize_file_name($files['resume']['name']);
    move_uploaded_file($files['resume']['tmp_name'], $resume_path);

    $meta = [
        'id'         => $id,
        'created_at' => time(),
        'attempts'   => 0,
        'last_error' => $error,
        'fields'     => [
            'full_name'        => $post['full_name'] ?? '',
            'email'            => $post['email'] ?? '',
            'phone'            => $post['phone'] ?? '',
            'experience_years' => $post['experience_years'] ?? '',
            'job_title'        => $post['job_title'] ?? '',
            'captcha_token'    => $post['captcha_token'] ?? ''
        ],
        'resume_path' => $resume_path,
        'resume_name' => $files['resume']['name'],
        'resume_type' => $files['resume']['type']
    ];
    file_put_contents(trailingslashit($queue_dir) . $id . '.json', wp_json_encode($meta));
}

// 4. Retry cron — runs every 5 min, up to 6 attempts per submission
add_filter('cron_schedules', function ($s) {
    $s['webdura_5min'] = ['interval' => 300, 'display' => 'Every 5 minutes'];
    return $s;
});
add_action('init', function () {
    if (!wp_next_scheduled('webdura_careers_retry_cron')) {
        wp_schedule_event(time() + 300, 'webdura_5min', 'webdura_careers_retry_cron');
    }
});
add_action('webdura_careers_retry_cron', function () {
    if (!defined('WEBDURA_HRM_ENDPOINT')) return;
    $upload = wp_upload_dir();
    $queue_dir = trailingslashit($upload['basedir']) . 'webdura-careers-queue';
    if (!is_dir($queue_dir)) return;
    foreach (glob($queue_dir . '/*.json') as $meta_file) {
        $meta = json_decode(file_get_contents($meta_file), true);
        if (!$meta || $meta['attempts'] >= 6) continue;

        $ts = time();
        $email = strtolower($meta['fields']['email']);
        $job_title = $meta['fields']['job_title'];
        $canonical = implode(':', ['v1', $ts, WEBDURA_HRM_API_KEY, $meta['id'], $email, strtolower($job_title)]);
        $signature = hash_hmac('sha256', $canonical, WEBDURA_HRM_API_SECRET);

        $ch = curl_init(WEBDURA_HRM_ENDPOINT);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => [
                'X-Webdura-Api-Key: ' . WEBDURA_HRM_API_KEY,
                'X-Webdura-Signature: t=' . $ts . ',v1=' . $signature,
                'X-Webdura-Idempotency: ' . $meta['id']
            ],
            CURLOPT_POSTFIELDS => array_merge($meta['fields'], [
                'source' => 'wordpress_careers_retry',
                'resume' => new CURLFile($meta['resume_path'], $meta['resume_type'], $meta['resume_name'])
            ])
        ]);
        $body = curl_exec($ch);
        $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http >= 200 && $http < 300) {
            @unlink($meta['resume_path']);
            @unlink($meta_file);
        } else {
            $meta['attempts']   += 1;
            $meta['last_error']  = "HTTP $http";
            $meta['last_try_at'] = time();
            file_put_contents($meta_file, wp_json_encode($meta));
            if ($meta['attempts'] >= 6 && function_exists('wp_mail')) {
                wp_mail(get_option('admin_email'), 'Webdura careers submission stuck',
                    'A submission has failed 6 times. File: ' . basename($meta_file));
            }
        }
    }
});
