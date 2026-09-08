<?php
/**
 * Plugin Name: thinkany design Export
 * Plugin URI:  https://thinkany.design
 * Description: Read-only export of this site's structure and content (ACF field groups, blocks, pages, posts, custom types, menus, media) as one JSON payload, for a redesign in thinkany design. Writes nothing.
 * Version:     0.1.2
 * Author:      thinkany
 * License:     Proprietary
 * Requires PHP: 7.4
 *
 * ©2026 thinkany llc. All rights reserved.
 *
 * WHAT THIS DOES
 *   One GET endpoint (and a WP-CLI command) that returns the site as data:
 *     GET /wp-json/thinkany/v1/export        header  X-Thinkany-Token: <token>
 *     wp thinkany export [--out=<file>]
 *   The token is generated on activation and shown under Settings → thinkany design Export.
 *
 * WHAT THIS NEVER DOES
 *   Write to the database, touch uploads, or change any option other than its own
 *   token. It reads through WordPress's own APIs (and ACF's when present). Deactivate
 *   it when the export is done.
 */

if (!defined('ABSPATH')) exit;

final class Thinkany_Export {
    const VERSION = '0.1.2';
    const PAYLOAD_VERSION = 1;
    const OPTION = 'thinkany_export_token';

    public static function boot() {
        register_activation_hook(__FILE__, [__CLASS__, 'activate']);
        add_action('rest_api_init', [__CLASS__, 'routes']);
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_post_thinkany_export_rotate', [__CLASS__, 'rotate']);
        if (defined('WP_CLI') && WP_CLI) {
            WP_CLI::add_command('thinkany export', [__CLASS__, 'cli']);
        }
    }

    // ---- token ----------------------------------------------------------------
    public static function activate() {
        if (!get_option(self::OPTION)) update_option(self::OPTION, wp_generate_password(40, false, false), false);
    }
    public static function token() {
        $t = get_option(self::OPTION);
        if (!$t) { self::activate(); $t = get_option(self::OPTION); }
        return $t;
    }
    public static function rotate() {
        if (!current_user_can('manage_options')) wp_die('Not allowed.');
        check_admin_referer('thinkany_export_rotate');
        update_option(self::OPTION, wp_generate_password(40, false, false), false);
        wp_safe_redirect(admin_url('options-general.php?page=thinkany-export&rotated=1'));
        exit;
    }

    // ---- admin page -------------------------------------------------------------
    public static function menu() {
        add_options_page('thinkany design Export', 'thinkany design Export', 'manage_options', 'thinkany-export', [__CLASS__, 'page']);
    }
    public static function page() {
        if (!current_user_can('manage_options')) return;
        $token = self::token();
        $url = rest_url('thinkany/v1/export');
        $home = home_url('/');
        $acf = function_exists('acf_get_field_groups') ? 'found' : 'not found (page and block fields will be missing)';
        // The app's admin look: white ground, black copy, a pill button, 1px-stroke icons.
        $copyIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        $checkIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';
        $row = function ($label, $value) use ($copyIcon, $checkIcon) {
            return '<div class="ta-row"><div class="ta-k">' . esc_html($label) . '</div>'
                . '<div class="ta-v"><code class="ta-code">' . esc_html($value) . '</code>'
                . '<button type="button" class="ta-copy" data-copy="' . esc_attr($value) . '" aria-label="Copy ' . esc_attr($label) . '" title="Copy"><span class="ta-ic-copy">' . $copyIcon . '</span><span class="ta-ic-done">' . $checkIcon . '</span></button></div></div>';
        };
        ?>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;700&family=Inter:wght@300;400;500&display=swap" rel="stylesheet" />
        <style>
          .ta-wrap { max-width: 720px; margin: 24px 0 0; font-family: 'Inter', system-ui, sans-serif; color: #111; }
          .ta-card { background: #fff; border: 1px solid #e6e6e6; border-radius: 8px; padding: 28px 32px; }
          .ta-card h1 { font-family: 'DM Sans', system-ui, sans-serif; font-weight: 700; font-size: 22px; letter-spacing: -0.01em; margin: 0 0 6px; color: #111; padding: 0; }
          .ta-lead { font-weight: 300; font-size: 14px; line-height: 1.6; color: #111; margin: 0 0 22px; }
          .ta-row { display: grid; grid-template-columns: 140px 1fr; gap: 12px; align-items: center; padding: 12px 0; border-top: 1px solid #ececec; }
          .ta-row:last-of-type { border-bottom: 1px solid #ececec; }
          .ta-k { font-size: 12px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: #111; }
          .ta-v { display: flex; align-items: center; gap: 10px; min-width: 0; }
          .ta-code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: #111; background: #fafafa; border: 1px solid #ececec; border-radius: 4px; padding: 6px 10px; user-select: all; }
          .ta-copy { flex: none; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; background: #fff; color: #111; border: 1px solid #111; border-radius: 999px; cursor: pointer; padding: 0; }
          .ta-copy:hover { background: #111; color: #fff; }
          .ta-copy .ta-ic-done { display: none; }
          .ta-copy.is-done .ta-ic-copy { display: none; }
          .ta-copy.is-done .ta-ic-done { display: inline-flex; }
          .ta-copy.is-done { background: #111; color: #fff; }
          .ta-meta { font-size: 13px; font-weight: 300; color: #111; margin: 14px 0 22px; }
          .ta-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
          .ta-btn { font-family: 'Inter', system-ui, sans-serif; font-size: 13px; font-weight: 500; color: #fff; background: #111; border: 1px solid #111; border-radius: 999px; padding: 9px 18px; cursor: pointer; }
          .ta-btn:hover { background: #333; border-color: #333; }
          .ta-note { font-size: 12.5px; font-weight: 300; color: #111; margin: 0; }
          .ta-ok { background: #fff; border: 1px solid #111; border-radius: 6px; padding: 10px 14px; font-size: 13px; margin: 0 0 18px; }
        </style>
        <div class="wrap ta-wrap">
          <div class="ta-card">
            <h1>thinkany design Export</h1>
            <p class="ta-lead">This plugin only reads. Paste the address and token into thinkany design under Site → Settings → Import from WordPress.</p>
            <?php if (!empty($_GET['rotated'])) echo '<div class="ta-ok">A new token was generated. Paste the new one into the app.</div>'; ?>
            <?php echo $row('Site address', $home); echo $row('Token', $token); echo $row('Endpoint', $url); ?>
            <div class="ta-meta">ACF: <?php echo esc_html($acf); ?></div>
            <div class="ta-actions">
              <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin:0">
                <?php wp_nonce_field('thinkany_export_rotate'); ?>
                <input type="hidden" name="action" value="thinkany_export_rotate" />
                <button type="submit" class="ta-btn">Generate a new token</button>
              </form>
              <p class="ta-note">Deactivate the plugin once the export is done.</p>
            </div>
          </div>
        </div>
        <script>
          (function () {
            var buttons = document.querySelectorAll('.ta-copy');
            function fallback(text) {
              var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
              document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
            }
            Array.prototype.forEach.call(buttons, function (b) {
              b.addEventListener('click', function () {
                var text = b.getAttribute('data-copy') || '';
                var done = function () { b.classList.add('is-done'); setTimeout(function () { b.classList.remove('is-done'); }, 1400); };
                if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
                else { fallback(text); done(); }
              });
            });
          })();
        </script>
        <?php
    }

    // ---- REST -----------------------------------------------------------------
    public static function routes() {
        register_rest_route('thinkany/v1', '/export', [
            'methods' => 'GET',
            'callback' => [__CLASS__, 'rest'],
            'permission_callback' => [__CLASS__, 'permit'],
        ]);
        register_rest_route('thinkany/v1', '/ping', [
            'methods' => 'GET',
            'callback' => function () { return ['ok' => true, 'plugin' => self::VERSION, 'payload' => self::PAYLOAD_VERSION]; },
            'permission_callback' => [__CLASS__, 'permit'],
        ]);
    }
    public static function permit($req) {
        $given = $req->get_header('x-thinkany-token');
        if (!$given) $given = $req->get_param('token');
        if (!$given) return new WP_Error('thinkany_no_token', 'Missing token.', ['status' => 401]);
        if (!hash_equals((string) self::token(), (string) $given)) return new WP_Error('thinkany_bad_token', 'Wrong token.', ['status' => 403]);
        return true;
    }
    public static function rest($req) {
        @set_time_limit(300);
        return rest_ensure_response(self::payload());
    }

    // ---- WP-CLI ---------------------------------------------------------------
    public static function cli($args, $assoc) {
        $json = wp_json_encode(self::payload(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!empty($assoc['out'])) { file_put_contents($assoc['out'], $json); WP_CLI::success('Wrote ' . $assoc['out']); }
        else WP_CLI::line($json);
    }

    // ---- the payload --------------------------------------------------------------
    public static function payload() {
        $hasAcf = function_exists('acf_get_field_groups');
        return [
            'kind' => 'thinkany-wordpress-export',
            'version' => self::PAYLOAD_VERSION,
            'direction' => 'from-wordpress',
            'plugin' => self::VERSION,
            'exported' => gmdate('c'),
            'site' => self::site(),
            'definitions' => self::definitions($hasAcf),
            'entries' => self::entries($hasAcf),
            'media' => self::media(),
            'forms' => self::forms(),
        ];
    }

    private static function site() {
        $menus = [];
        foreach (wp_get_nav_menus() as $m) {
            $items = [];
            foreach ((array) wp_get_nav_menu_items($m->term_id) as $it) {
                $items[] = [
                    'id' => (int) $it->ID, 'parent' => (int) $it->menu_item_parent, 'order' => (int) $it->menu_order,
                    'title' => $it->title, 'url' => $it->url, 'type' => $it->type, 'object' => $it->object,
                    'objectId' => (int) $it->object_id, 'target' => $it->target,
                ];
            }
            $menus[] = ['id' => (int) $m->term_id, 'name' => $m->name, 'slug' => $m->slug, 'locations' => array_keys(array_filter(get_nav_menu_locations(), function ($id) use ($m) { return (int) $id === (int) $m->term_id; })), 'items' => $items];
        }
        $options = null;
        if (function_exists('get_fields')) { $o = get_fields('option'); if (is_array($o)) $options = self::clean($o); }
        return [
            'name' => get_bloginfo('name'), 'tagline' => get_bloginfo('description'),
            'home' => home_url('/'), 'wpVersion' => get_bloginfo('version'),
            'frontPage' => (int) get_option('page_on_front'), 'postsPage' => (int) get_option('page_for_posts'),
            'showOnFront' => get_option('show_on_front'), 'permalinkStructure' => get_option('permalink_structure'),
            'language' => get_bloginfo('language'), 'timezone' => wp_timezone_string(),
            'menus' => $menus, 'options' => $options,
            'seoPlugin' => defined('WPSEO_VERSION') ? 'yoast' : (defined('RANK_MATH_VERSION') ? 'rankmath' : null),
        ];
    }

    private static function definitions($hasAcf) {
        $out = ['postTypes' => [], 'taxonomies' => [], 'fieldGroups' => [], 'blocks' => [], 'optionsPages' => []];
        foreach (get_post_types(['public' => true], 'objects') as $pt) {
            if (in_array($pt->name, ['attachment'], true)) continue;
            $out['postTypes'][] = [
                'key' => $pt->name, 'label' => $pt->label, 'singular' => $pt->labels->singular_name ?? $pt->label,
                'builtin' => (bool) $pt->_builtin, 'hierarchical' => (bool) $pt->hierarchical,
                'hasArchive' => (bool) $pt->has_archive, 'rewrite' => is_array($pt->rewrite) ? ($pt->rewrite['slug'] ?? $pt->name) : $pt->name,
                'supports' => array_keys(array_filter((array) get_all_post_type_supports($pt->name))),
                'taxonomies' => array_values(get_object_taxonomies($pt->name)),
                'count' => (int) (wp_count_posts($pt->name)->publish ?? 0),
            ];
        }
        foreach (get_taxonomies(['public' => true], 'objects') as $tx) {
            $terms = get_terms(['taxonomy' => $tx->name, 'hide_empty' => false, 'number' => 500]);
            $out['taxonomies'][] = [
                'key' => $tx->name, 'label' => $tx->label, 'hierarchical' => (bool) $tx->hierarchical, 'objectTypes' => $tx->object_type,
                'terms' => is_wp_error($terms) ? [] : array_map(function ($t) { return ['id' => (int) $t->term_id, 'name' => $t->name, 'slug' => $t->slug, 'parent' => (int) $t->parent, 'count' => (int) $t->count]; }, $terms),
            ];
        }
        if ($hasAcf) {
            foreach (acf_get_field_groups() as $g) {
                $fields = acf_get_fields($g);
                $out['fieldGroups'][] = [
                    'key' => $g['key'], 'title' => $g['title'], 'location' => $g['location'] ?? [],
                    'active' => !empty($g['active']), 'fields' => self::acfFields(is_array($fields) ? $fields : []),
                ];
            }
            if (function_exists('acf_get_block_types')) {
                foreach (acf_get_block_types() as $name => $b) {
                    $out['blocks'][] = [
                        'name' => $name, 'title' => $b['title'] ?? $name, 'description' => $b['description'] ?? '',
                        'category' => $b['category'] ?? '', 'mode' => $b['mode'] ?? '', 'supports' => $b['supports'] ?? [],
                    ];
                }
            }
            if (function_exists('acf_get_options_pages')) {
                $pages = acf_get_options_pages();
                foreach (is_array($pages) ? $pages : [] as $p) $out['optionsPages'][] = ['slug' => $p['menu_slug'] ?? '', 'title' => $p['page_title'] ?? '', 'postId' => $p['post_id'] ?? 'options'];
            }
        }
        // Block types in use on the site that ACF does not own (core and other plugins).
        $out['blocksInUse'] = self::blocksInUse();
        return $out;
    }

    // Field definitions, trimmed to what a mapping needs (recursive for groups, repeaters, flexible content).
    private static function acfFields(array $fields) {
        $out = [];
        foreach ($fields as $f) {
            $d = [
                'key' => $f['key'], 'name' => $f['name'], 'label' => $f['label'], 'type' => $f['type'],
                'required' => !empty($f['required']),
            ];
            foreach (['instructions', 'return_format', 'choices', 'multiple', 'min', 'max', 'post_type', 'taxonomy', 'button_label', 'default_value', 'allow_null', 'layout', 'ui', 'ui_on_text', 'ui_off_text'] as $k) {
                if (isset($f[$k]) && $f[$k] !== '' && $f[$k] !== 0 && $f[$k] !== []) $d[$k] = $f[$k];
            }
            // Which fields this one is shown for (ACF's conditional logic): groups of AND rules,
            // each naming another field by KEY. The importer resolves keys to names.
            if (!empty($f['conditional_logic']) && is_array($f['conditional_logic'])) {
                $rules = [];
                foreach ($f['conditional_logic'] as $group) {
                    $g = [];
                    foreach ((array) $group as $r) if (!empty($r['field'])) $g[] = ['field' => $r['field'], 'operator' => $r['operator'] ?? '==', 'value' => $r['value'] ?? ''];
                    if ($g) $rules[] = $g;
                }
                if ($rules) $d['conditionalLogic'] = $rules;
            }
            if (!empty($f['sub_fields']) && is_array($f['sub_fields'])) $d['subFields'] = self::acfFields($f['sub_fields']);
            if ($f['type'] === 'flexible_content' && !empty($f['layouts'])) {
                $d['layouts'] = [];
                foreach ($f['layouts'] as $l) $d['layouts'][] = ['key' => $l['key'], 'name' => $l['name'], 'label' => $l['label'], 'subFields' => self::acfFields($l['sub_fields'] ?? [])];
            }
            $out[] = $d;
        }
        return $out;
    }

    private static function blocksInUse() {
        global $wpdb;
        $counts = [];
        $rows = $wpdb->get_col("SELECT post_content FROM {$wpdb->posts} WHERE post_status IN ('publish','draft','private','future','pending') AND post_type NOT IN ('revision','nav_menu_item','attachment','customize_changeset','oembed_cache','wp_global_styles','wp_navigation','wp_template','wp_template_part','wp_block','acf-field','acf-field-group','acf-post-type','acf-taxonomy','acf-ui-options-page')");
        foreach ($rows as $content) {
            if (!has_blocks($content)) continue;
            self::countBlocks(parse_blocks($content), $counts);
        }
        arsort($counts);
        return $counts;
    }
    private static function countBlocks(array $blocks, array &$counts) {
        foreach ($blocks as $b) {
            if (!empty($b['blockName'])) $counts[$b['blockName']] = ($counts[$b['blockName']] ?? 0) + 1;
            if (!empty($b['innerBlocks'])) self::countBlocks($b['innerBlocks'], $counts);
        }
    }

    private static function entries($hasAcf) {
        $types = array_keys(get_post_types(['public' => true]));
        $types = array_values(array_diff($types, ['attachment']));
        $out = [];
        $q = new WP_Query([
            'post_type' => $types, 'post_status' => ['publish', 'draft', 'private', 'future', 'pending'],
            'posts_per_page' => -1, 'orderby' => ['post_type' => 'ASC', 'menu_order' => 'ASC', 'post_date' => 'DESC'], 'no_found_rows' => true,
        ]);
        foreach ($q->posts as $p) $out[] = self::entry($p, $hasAcf);
        return $out;
    }

    private static function entry(WP_Post $p, $hasAcf) {
        $terms = [];
        foreach (get_object_taxonomies($p->post_type) as $tx) {
            $ts = get_the_terms($p, $tx);
            if (is_array($ts)) foreach ($ts as $t) $terms[] = ['taxonomy' => $tx, 'id' => (int) $t->term_id, 'name' => $t->name, 'slug' => $t->slug];
        }
        $thumb = (int) get_post_thumbnail_id($p);
        $author = get_userdata((int) $p->post_author);
        $e = [
            'id' => (int) $p->ID, 'type' => $p->post_type, 'status' => $p->post_status,
            'title' => get_the_title($p), 'slug' => $p->post_name, 'url' => get_permalink($p),
            'path' => self::pathOf(get_permalink($p)),
            'parent' => (int) $p->post_parent, 'order' => (int) $p->menu_order,
            'date' => get_post_time('c', true, $p), 'modified' => get_post_modified_time('c', true, $p),
            'author' => $author ? $author->display_name : '', 'excerpt' => $p->post_excerpt,
            'featuredImage' => $thumb ?: null, 'terms' => $terms,
            'template' => get_page_template_slug($p) ?: null,
            'seo' => self::seo($p->ID),
        ];
        if (has_blocks($p->post_content)) {
            $e['blocks'] = self::blocks(parse_blocks($p->post_content), $p->ID, $hasAcf);
        } else {
            $e['classic'] = true;
            $e['html'] = $p->post_content;
        }
        if ($hasAcf && function_exists('get_fields')) {
            $f = get_fields($p->ID);
            if (is_array($f) && $f) $e['fields'] = self::clean($f);
        }
        return $e;
    }

    // The parsed block tree, with ACF blocks resolved to their formatted field values.
    private static function blocks(array $blocks, $postId, $hasAcf) {
        $out = [];
        foreach ($blocks as $i => $b) {
            if (empty($b['blockName'])) {
                // Free-form HTML between blocks (usually whitespace). Keep it only when it says something.
                $html = trim((string) ($b['innerHTML'] ?? ''));
                if ($html !== '') $out[] = ['name' => 'core/freeform', 'html' => $html];
                continue;
            }
            $item = ['name' => $b['blockName']];
            if (strpos($b['blockName'], 'acf/') === 0) {
                $attrs = $b['attrs'] ?? [];
                $data = $attrs['data'] ?? [];
                $item['blockId'] = $attrs['id'] ?? ('block_' . $postId . '_' . $i);
                $item['raw'] = $data;
                if ($hasAcf && function_exists('acf_setup_meta') && function_exists('get_fields')) {
                    acf_setup_meta($data, $item['blockId'], true);
                    $fields = get_fields($item['blockId']);
                    acf_reset_meta($item['blockId']);
                    $item['fields'] = is_array($fields) ? self::clean($fields) : (object) [];
                }
                foreach (['align', 'className', 'anchor', 'mode', 'style'] as $k) if (isset($attrs[$k])) $item[$k] = $attrs[$k];
            } else {
                $item['attrs'] = $b['attrs'] ?? [];
                $item['html'] = trim((string) ($b['innerHTML'] ?? ''));
                if (!empty($b['innerBlocks'])) {
                    $item['inner'] = self::blocks($b['innerBlocks'], $postId, $hasAcf);
                    // The rendered whole is handy for prose blocks (lists, columns, groups).
                    $item['rendered'] = trim((string) render_block($b));
                }
            }
            $out[] = $item;
        }
        return $out;
    }

    // Formatted ACF values contain objects (WP_Post, WP_Term); flatten to plain data. Images keep
    // the fields the importer reads (ID, url, alt, width, height, mime, filename, caption, title).
    private static function clean($v, $depth = 0) {
        if ($depth > 12) return null;
        if ($v instanceof WP_Post) return ['post' => (int) $v->ID, 'type' => $v->post_type, 'title' => get_the_title($v), 'slug' => $v->post_name, 'url' => get_permalink($v)];
        if ($v instanceof WP_Term) return ['term' => (int) $v->term_id, 'taxonomy' => $v->taxonomy, 'name' => $v->name, 'slug' => $v->slug];
        if ($v instanceof WP_User) return ['user' => (int) $v->ID, 'name' => $v->display_name];
        if (is_object($v)) $v = (array) $v;
        if (is_array($v)) {
            if (isset($v['ID'], $v['url'], $v['mime_type']) && strpos((string) $v['mime_type'], 'image/') === 0) {
                return ['image' => (int) $v['ID'], 'url' => $v['url'], 'alt' => $v['alt'] ?? '', 'title' => $v['title'] ?? '', 'caption' => $v['caption'] ?? '', 'width' => $v['width'] ?? null, 'height' => $v['height'] ?? null, 'mime' => $v['mime_type'], 'filename' => $v['filename'] ?? basename((string) $v['url'])];
            }
            $o = [];
            foreach ($v as $k => $x) $o[$k] = self::clean($x, $depth + 1);
            return $o;
        }
        return $v;
    }

    private static function seo($id) {
        $m = function ($k) use ($id) { $v = get_post_meta($id, $k, true); return is_string($v) ? $v : ''; };
        if (defined('WPSEO_VERSION')) {
            $img = $m('_yoast_wpseo_opengraph-image');
            return ['plugin' => 'yoast', 'title' => $m('_yoast_wpseo_title'), 'description' => $m('_yoast_wpseo_metadesc'),
                'noindex' => $m('_yoast_wpseo_meta-robots-noindex') === '1', 'canonical' => $m('_yoast_wpseo_canonical'),
                'keyphrase' => $m('_yoast_wpseo_focuskw'), 'image' => $img ?: null];
        }
        if (defined('RANK_MATH_VERSION')) {
            $robots = get_post_meta($id, 'rank_math_robots', true);
            $img = $m('rank_math_facebook_image');
            return ['plugin' => 'rankmath', 'title' => $m('rank_math_title'), 'description' => $m('rank_math_description'),
                'noindex' => is_array($robots) && in_array('noindex', $robots, true), 'canonical' => $m('rank_math_canonical_url'),
                'keyphrase' => $m('rank_math_focus_keyword'), 'image' => $img ?: null];
        }
        return null;
    }

    private static function media() {
        $out = [];
        $q = new WP_Query(['post_type' => 'attachment', 'post_status' => 'inherit', 'posts_per_page' => -1, 'no_found_rows' => true]);
        foreach ($q->posts as $a) {
            $meta = wp_get_attachment_metadata($a->ID);
            $out[] = [
                'id' => (int) $a->ID, 'url' => wp_get_attachment_url($a->ID), 'mime' => $a->post_mime_type,
                'filename' => basename((string) get_attached_file($a->ID)),
                'width' => is_array($meta) ? ($meta['width'] ?? null) : null, 'height' => is_array($meta) ? ($meta['height'] ?? null) : null,
                'size' => is_array($meta) ? ($meta['filesize'] ?? null) : null,
                'alt' => (string) get_post_meta($a->ID, '_wp_attachment_image_alt', true),
                'caption' => $a->post_excerpt, 'title' => $a->post_title, 'parent' => (int) $a->post_parent,
            ];
        }
        return $out;
    }

    // Forms plugins, best effort: the fields as a simple list for the app's Forms tab.
    private static function forms() {
        $out = [];
        if (class_exists('GFAPI')) {
            foreach ((array) GFAPI::get_forms() as $f) {
                $fields = [];
                foreach ((array) ($f['fields'] ?? []) as $fl) $fields[] = ['id' => (string) $fl->id, 'type' => $fl->type, 'label' => $fl->label, 'required' => !empty($fl->isRequired), 'choices' => array_map(function ($c) { return $c['text'] ?? ''; }, is_array($fl->choices) ? $fl->choices : [])];
                $out[] = ['plugin' => 'gravityforms', 'id' => (string) $f['id'], 'title' => $f['title'], 'fields' => $fields];
            }
        }
        if (function_exists('wpforms') && wpforms()->form) {
            foreach ((array) wpforms()->form->get('', ['orderby' => 'ID']) as $p) {
                $data = json_decode($p->post_content, true);
                $fields = [];
                foreach ((array) ($data['fields'] ?? []) as $fl) $fields[] = ['id' => (string) ($fl['id'] ?? ''), 'type' => $fl['type'] ?? '', 'label' => $fl['label'] ?? '', 'required' => !empty($fl['required']), 'choices' => array_values(array_map(function ($c) { return $c['label'] ?? ''; }, (array) ($fl['choices'] ?? [])))];
                $out[] = ['plugin' => 'wpforms', 'id' => (string) $p->ID, 'title' => $p->post_title, 'fields' => $fields];
            }
        }
        return $out;
    }

    private static function pathOf($url) {
        $p = wp_parse_url($url, PHP_URL_PATH);
        $p = '/' . trim((string) $p, '/');
        return $p === '//' ? '/' : $p;
    }
}

Thinkany_Export::boot();
