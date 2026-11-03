// Browser half of dsh-hindsight-panel.
//
// Hand-written module-loader bundle (no build step): React comes from the
// harness's module loader, all data goes through the host half's
// /api/dsh-hindsight-panel/* routes.
//
// Registers two slots:
//   - sidebar.panellist -> the brain icon in the sidebar
//   - main (key: PANEL_ID) -> the panel that icon opens

window.__ModuleLoader__.load({
  id: "dsh-hindsight-panel",
  factory: function (require) {
    "use strict";

    var React = require("react");
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useMemo = React.useMemo;
    var useCallback = React.useCallback;
    var useRef = React.useRef;

    var PANEL_ID = "hindsight-panel";
    var PANEL_ORDER = 3;
    var STYLE_ID = "hsp-style";
    var API_BASE = "/api/dsh-hindsight-panel";
    var PAGE_SIZE = 24;

    // ---------------------------------------------------------------------
    // styles
    // ---------------------------------------------------------------------

    var CSS = `
.hsp_panel{--hsp-accent:#7c6cf6;--hsp-accent-2:#4aa8ff;--hsp-world:#4aa8ff;--hsp-experience:#8b7cf6;--hsp-observation:#2ec4b6;height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55}
.hsp_panel *{box-sizing:border-box}
.hsp_topbar{position:relative;display:flex;align-items:center;gap:14px;padding:18px clamp(18px,3vw,30px) 14px;border-bottom:.5px solid var(--dsw-alias-border-l1);background:linear-gradient(120deg,rgba(124,108,246,.14),rgba(74,168,255,.10) 42%,transparent 72%),var(--dsw-alias-bg-layer-1)}
.hsp_badge_icon{width:40px;height:40px;flex:0 0 40px;display:flex;align-items:center;justify-content:center;border-radius:13px;color:#fff;background:linear-gradient(135deg,var(--hsp-accent),var(--hsp-accent-2));box-shadow:0 6px 18px rgba(124,108,246,.35)}
.hsp_titles{min-width:0;flex:1}
.hsp_title{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:600;letter-spacing:.01em}
.hsp_subtitle{margin-top:1px;font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hsp_topbar_actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.hsp_tabs{display:flex;align-items:center;gap:4px;padding:8px clamp(18px,3vw,30px);border-bottom:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}
.hsp_tab{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;padding:6px 14px;border-radius:9px;cursor:pointer;transition:background .16s ease,color .16s ease}
.hsp_tab:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.hsp_tab[data-active="true"]{background:rgba(124,108,246,.16);color:var(--dsw-alias-label-primary);font-weight:600}
.hsp_scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}
.hsp_inner{max-width:1020px;margin:0 auto;padding:20px clamp(18px,3vw,30px) 56px;display:flex;flex-direction:column;gap:16px}
.hsp_card{border:.5px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);padding:16px 18px}
.hsp_card_head{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.hsp_card_title{font-size:13px;font-weight:600}
.hsp_card_hint{font-size:12px;color:var(--dsw-alias-label-secondary)}
.hsp_row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hsp_grow{flex:1;min-width:0}
.hsp_kv{display:grid;grid-template-columns:112px minmax(0,1fr);gap:6px 14px;font-size:12.5px}
.hsp_kv dt{color:var(--dsw-alias-label-secondary)}
.hsp_kv dd{margin:0;min-width:0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.hsp_mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px}
.hsp_pill{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:999px;font-size:11.5px;font-weight:500;border:.5px solid transparent;white-space:nowrap}
.hsp_pill[data-tone="ok"]{color:var(--dsw-alias-state-success-primary);background:rgba(46,196,182,.13);border-color:rgba(46,196,182,.28)}
.hsp_pill[data-tone="off"]{color:var(--dsw-alias-state-error-primary);background:rgba(226,86,86,.12);border-color:rgba(226,86,86,.25)}
.hsp_pill[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary);background:rgba(240,180,60,.14);border-color:rgba(240,180,60,.3)}
.hsp_pill[data-tone="idle"]{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.hsp_pill[data-tone="accent"]{color:#fff;background:linear-gradient(135deg,var(--hsp-accent),var(--hsp-accent-2));border-color:transparent}
.hsp_dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:0 0 6px}
.hsp_btn{appearance:none;font:inherit;font-size:12.5px;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 14px;border-radius:9px;cursor:pointer;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);transition:filter .15s ease,transform .05s ease,background .15s ease;white-space:nowrap}
.hsp_btn:hover{filter:brightness(1.06)}
.hsp_btn:active{transform:translateY(1px)}
.hsp_btn[disabled]{opacity:.5;cursor:not-allowed;transform:none}
.hsp_btn_primary{border-color:transparent;background:linear-gradient(135deg,var(--hsp-accent),var(--hsp-accent-2));color:#fff;font-weight:600;box-shadow:0 4px 14px rgba(124,108,246,.28)}
.hsp_btn_ghost{background:transparent;border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}
.hsp_btn_danger{border-color:rgba(226,86,86,.4);color:var(--dsw-alias-state-error-primary);background:rgba(226,86,86,.1)}
.hsp_btn_icon{width:32px;padding:0}
.hsp_input,.hsp_select,.hsp_textarea{font:inherit;font-size:12.5px;height:34px;padding:0 10px;border-radius:9px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);min-width:0;width:100%}
.hsp_textarea{height:auto;padding:8px 10px;resize:vertical}
.hsp_input:focus,.hsp_select:focus{outline:2px solid rgba(124,108,246,.45);outline-offset:1px}
.hsp_field{display:flex;flex-direction:column;gap:5px;min-width:0}
.hsp_label{font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.hsp_form_grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.hsp_actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px}
.hsp_callout{display:flex;gap:9px;border-radius:11px;padding:10px 12px;font-size:12.5px;border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.hsp_callout[data-tone="error"]{border-color:rgba(226,86,86,.35);background:rgba(226,86,86,.09);color:var(--dsw-alias-state-error-primary)}
.hsp_callout[data-tone="success"]{border-color:rgba(46,196,182,.35);background:rgba(46,196,182,.1);color:var(--dsw-alias-state-success-primary)}
.hsp_callout[data-tone="warn"]{border-color:rgba(240,180,60,.35);background:rgba(240,180,60,.1);color:var(--dsw-alias-state-warn-primary)}
.hsp_stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.hsp_stat{border:.5px solid var(--dsw-alias-border-l1);border-radius:13px;background:var(--dsw-alias-bg-layer-1);padding:13px 15px;position:relative;overflow:hidden}
.hsp_stat::before{content:"";position:absolute;inset:0 auto 0 0;width:3px;background:var(--hsp-accent)}
.hsp_stat[data-accent="world"]::before{background:var(--hsp-world)}
.hsp_stat[data-accent="experience"]::before{background:var(--hsp-experience)}
.hsp_stat[data-accent="observation"]::before{background:var(--hsp-observation)}
.hsp_stat[data-accent="links"]::before{background:linear-gradient(180deg,var(--hsp-accent),var(--hsp-accent-2))}
.hsp_stat_value{font-size:22px;font-weight:650;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.hsp_stat_label{font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-top:1px}
.hsp_charts{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr);gap:12px}
@media (max-width:820px){.hsp_charts{grid-template-columns:minmax(0,1fr)}}
.hsp_donut_row{display:flex;align-items:center;gap:18px}
.hsp_donut{width:104px;height:104px;flex:0 0 104px;border-radius:50%;position:relative}
.hsp_donut::after{content:"";position:absolute;inset:18px;border-radius:50%;background:var(--dsw-alias-bg-layer-1)}
.hsp_donut_center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1;pointer-events:none}
.hsp_donut_num{font-size:17px;font-weight:650;font-variant-numeric:tabular-nums}
.hsp_donut_cap{font-size:10px;color:var(--dsw-alias-label-secondary)}
.hsp_legend{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
.hsp_legend_row{display:flex;align-items:center;gap:7px;font-size:12px}
.hsp_legend_swatch{width:8px;height:8px;border-radius:3px;flex:0 0 8px}
.hsp_legend_name{color:var(--dsw-alias-label-secondary)}
.hsp_legend_value{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:600}
.hsp_spark{width:100%;height:118px;display:block}
.hsp_search{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.hsp_search_box{position:relative;flex:1;min-width:200px}
.hsp_search_box .hsp_input{padding-left:32px}
.hsp_search_icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--dsw-alias-label-secondary);display:flex}
.hsp_chips{display:flex;gap:6px;flex-wrap:wrap}
.hsp_chip{appearance:none;font:inherit;font-size:12px;height:26px;padding:0 11px;border-radius:999px;cursor:pointer;border:.5px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary)}
.hsp_chip[data-active="true"]{background:rgba(124,108,246,.16);border-color:rgba(124,108,246,.45);color:var(--dsw-alias-label-primary);font-weight:600}
.hsp_mem_grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.hsp_mem{border:.5px solid var(--dsw-alias-border-l1);border-radius:13px;background:var(--dsw-alias-bg-layer-1);padding:12px 14px;display:flex;flex-direction:column;gap:7px;cursor:pointer;transition:border-color .16s ease,transform .16s ease,box-shadow .16s ease;position:relative;overflow:hidden}
.hsp_mem:hover{border-color:rgba(124,108,246,.45);transform:translateY(-1px);box-shadow:0 8px 20px rgba(20,20,40,.08)}
.hsp_mem[data-expanded="true"]{grid-column:1/-1;border-color:rgba(124,108,246,.5)}
.hsp_mem_head{display:flex;align-items:center;gap:8px}
.hsp_mem_time{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}
.hsp_type{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 8px;border-radius:6px;font-size:11px;font-weight:600;letter-spacing:.01em}
.hsp_type[data-type="world"]{color:#2f7fd8;background:rgba(74,168,255,.14)}
.hsp_type[data-type="experience"]{color:#6a55e0;background:rgba(139,124,246,.16)}
.hsp_type[data-type="observation"]{color:#12897e;background:rgba(46,196,182,.15)}
.hsp_mem_text{margin:0;font-size:12.5px;line-height:1.65;color:var(--dsw-alias-label-primary);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.hsp_mem[data-expanded="true"] .hsp_mem_text{-webkit-line-clamp:unset;display:block}
.hsp_mem_meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-secondary)}
.hsp_tag{height:19px;display:inline-flex;align-items:center;padding:0 7px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10.5px}
.hsp_score{font-variant-numeric:tabular-nums}
.hsp_list{display:flex;flex-direction:column;gap:2px}
.hsp_list_row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;font-size:12.5px}
.hsp_list_row:hover{background:var(--dsw-alias-bg-layer-2)}
.hsp_list_row + .hsp_list_row{border-top:.5px solid var(--dsw-alias-border-l1)}
.hsp_list_main{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hsp_list_meta{font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}
.hsp_empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:36px 16px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12.5px}
.hsp_empty_icon{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.hsp_skel{height:12px;border-radius:6px;background:linear-gradient(90deg,var(--dsw-alias-bg-layer-2),var(--dsw-alias-border-l1),var(--dsw-alias-bg-layer-2));background-size:200% 100%;animation:hsp_shimmer 1.3s linear infinite}
@keyframes hsp_shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.hsp_steps{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.hsp_step{display:flex;align-items:flex-start;gap:9px;font-size:12.5px}
.hsp_step_mark{width:18px;height:18px;flex:0 0 18px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-size:10px}
.hsp_step[data-state="running"] .hsp_step_mark{border-color:rgba(124,108,246,.6);color:var(--hsp-accent);animation:hsp_pulse 1.2s ease-in-out infinite}
.hsp_step[data-state="done"] .hsp_step_mark{border-color:rgba(46,196,182,.6);background:rgba(46,196,182,.16);color:var(--dsw-alias-state-success-primary)}
.hsp_step[data-state="failed"] .hsp_step_mark{border-color:rgba(226,86,86,.6);background:rgba(226,86,86,.14);color:var(--dsw-alias-state-error-primary)}
@keyframes hsp_pulse{0%,100%{opacity:1}50%{opacity:.45}}
.hsp_step_body{min-width:0}
.hsp_step_label{font-weight:500}
.hsp_step_detail{font-size:11px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.hsp_pre{margin:8px 0 0;padding:10px 12px;border-radius:9px;background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l1);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:1.5;max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}
.hsp_hr{height:.5px;background:var(--dsw-alias-border-l1);margin:14px 0}
.hsp_danger{border-color:rgba(226,86,86,.3)}
.hsp_danger .hsp_card_title{color:var(--dsw-alias-state-error-primary)}
.hsp_footer{margin-top:4px;font-size:11px;color:var(--dsw-alias-label-secondary);text-align:center}
.hsp_loading_dots::after{content:"…"}
.hsp_nowrap{white-space:nowrap}
`;

    function ensureStyle() {
      if (typeof document === "undefined" || typeof document.getElementById !== "function") return;
      if (document.getElementById(STYLE_ID) !== null) return;
      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      (document.head || document.documentElement).appendChild(style);
    }

    // ---------------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------------

    function api(pathname, options) {
      var opts = options || {};
      var headers = { "x-dsh-hindsight-panel": "1" };
      var init = { method: opts.method || "GET", headers: headers, cache: "no-store" };
      if (opts.body !== undefined) {
        headers["content-type"] = "application/json";
        init.body = JSON.stringify(opts.body);
      }
      return fetch(API_BASE + pathname, init).then(function (response) {
        return response.text().then(function (text) {
          var data = null;
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (error) {
              data = null;
            }
          }
          if (!response.ok) {
            var message = data && data.error ? data.error : "HTTP " + response.status;
            throw new Error(message);
          }
          if (data && data.ok === false) throw new Error(data.error || "请求失败");
          return data;
        });
      });
    }

    function qs(params) {
      var search = new URLSearchParams();
      Object.keys(params || {}).forEach(function (key) {
        var value = params[key];
        if (value === undefined || value === null || value === "") return;
        search.set(key, String(value));
      });
      var text = search.toString();
      return text ? "?" + text : "";
    }

    function num(value) {
      var n = Number(value);
      return Number.isFinite(n) ? n.toLocaleString("zh-CN") : "—";
    }

    function pad2(value) {
      return value < 10 ? "0" + value : String(value);
    }

    function fmtDate(iso) {
      if (!iso) return "—";
      var d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "—";
      return pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    }

    function fmtDay(iso) {
      if (!iso) return "";
      var d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return "";
      return pad2(d.getMonth() + 1) + "/" + pad2(d.getDate());
    }

    function fmtDuration(ms) {
      if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "—";
      if (ms < 1000) return Math.round(ms) + "ms";
      return (ms / 1000).toFixed(1) + "s";
    }

    var TYPE_LABEL = { world: "世界", experience: "经验", observation: "观察" };

    function typeLabel(type) {
      return TYPE_LABEL[type] || type || "未知";
    }

    function typeColor(type) {
      if (type === "world") return "var(--hsp-world)";
      if (type === "experience") return "var(--hsp-experience)";
      if (type === "observation") return "var(--hsp-observation)";
      return "var(--dsw-alias-label-secondary)";
    }

    // ---------------------------------------------------------------------
    // icons
    // ---------------------------------------------------------------------

    function Svg(props) {
      return h(
        "svg",
        {
          width: props.size || 16,
          height: props.size || 16,
          viewBox: props.viewBox || "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: props.strokeWidth || 1.7,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": "true",
          style: props.style,
        },
        props.children
      );
    }

    function PanelIcon(props) {
      var size = props && typeof props.size === "number" ? props.size : 16;
      return h(
        Svg,
        { size: size },
        h("path", { key: "l", d: "M11.3 3.4c-1.7.2-3 1.2-3.5 2.7-1.4.4-2.4 1.6-2.4 3.1 0 .7.2 1.3.6 1.8-.5.5-.9 1.3-.9 2.1 0 1.4.9 2.5 2.1 2.9.5 1.6 1.9 2.7 3.6 2.7h.5" }),
        h("path", { key: "r", d: "M12.7 3.4c1.7.2 3 1.2 3.5 2.7 1.4.4 2.4 1.6 2.4 3.1 0 .7-.2 1.3-.6 1.8.5.5.9 1.3.9 2.1 0 1.4-.9 2.5-2.1 2.9-.5 1.6-1.9 2.7-3.6 2.7h-.5" }),
        h("path", { key: "m", d: "M12 3.2v17.5" })
      );
    }

    function IconRefresh(props) {
      return h(
        Svg,
        { size: props.size || 14 },
        h("path", { d: "M20 11a8 8 0 1 0-2.3 5.6" }),
        h("path", { d: "M20 4.5V11h-6.4" })
      );
    }

    function IconSearch(props) {
      return h(Svg, { size: props.size || 14 }, h("circle", { cx: 11, cy: 11, r: 6.4 }), h("path", { d: "M16 16l4.2 4.2" }));
    }

    function IconSpark(props) {
      return h(Svg, { size: props.size || 14 }, h("path", { d: "M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" }));
    }

    function IconTrash(props) {
      return h(
        Svg,
        { size: props.size || 14 },
        h("path", { d: "M4.5 6.5h15" }),
        h("path", { d: "M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7" }),
        h("path", { d: "M6.5 6.5l.8 12c.1 1 .9 1.7 1.9 1.7h5.6c1 0 1.8-.7 1.9-1.7l.8-12" })
      );
    }

    function IconCpu(props) {
      return h(
        Svg,
        { size: props.size || 14 },
        h("rect", { x: 6, y: 6, width: 12, height: 12, rx: 3 }),
        h("rect", { x: 9.5, y: 9.5, width: 5, height: 5, rx: 1.2 }),
        h("path", { d: "M9 3.5v2M15 3.5v2M9 18.5v2M15 18.5v2M3.5 9h2M3.5 15h2M18.5 9h2M18.5 15h2" })
      );
    }

    function IconDoc(props) {
      return h(
        Svg,
        { size: props.size || 14 },
        h("path", { d: "M7 3.5h6.5L18 8v12.5H7z" }),
        h("path", { d: "M13 3.5V8h5" })
      );
    }

    function IconInfo(props) {
      return h(Svg, { size: props.size || 14 }, h("circle", { cx: 12, cy: 12, r: 8.4 }), h("path", { d: "M12 11v5.2M12 7.9v.2" }));
    }

    // ---------------------------------------------------------------------
    // primitives
    // ---------------------------------------------------------------------

    function Pill(props) {
      return h("span", { className: "hsp_pill", "data-tone": props.tone || "idle" }, props.dot ? h("span", { className: "hsp_dot" }) : null, props.children);
    }

    function Card(props) {
      return h(
        "div",
        { className: "hsp_card" + (props.danger ? " hsp_danger" : "") + (props.className ? " " + props.className : "") },
        props.title !== undefined
          ? h(
              "div",
              { className: "hsp_card_head" },
              props.icon || null,
              h("span", { className: "hsp_card_title" }, props.title),
              props.hint ? h("span", { className: "hsp_card_hint" }, props.hint) : null,
              props.extra ? h("span", { className: "hsp_grow", style: { textAlign: "right" } }, props.extra) : null
            )
          : null,
        props.children
      );
    }

    function Stat(props) {
      return h(
        "div",
        { className: "hsp_stat", "data-accent": props.accent || "links" },
        h("div", { className: "hsp_stat_value" }, props.value),
        h("div", { className: "hsp_stat_label" }, props.label)
      );
    }

    function Callout(props) {
      return h("div", { className: "hsp_callout", "data-tone": props.tone || "info" }, h("span", { style: { marginTop: 1, display: "flex" } }, props.icon || h(IconInfo, null)), h("div", { className: "hsp_grow" }, props.children));
    }

    function Field(props) {
      return h(
        "label",
        { className: "hsp_field" },
        h("span", { className: "hsp_label" }, props.label),
        props.children,
        props.hint ? h("span", { className: "hsp_label", style: { opacity: 0.8 } }, props.hint) : null
      );
    }

    function Donut(props) {
      var parts = props.parts || [];
      var total = parts.reduce(function (sum, part) { return sum + (Number(part.value) || 0); }, 0);
      var background = "var(--dsw-alias-bg-layer-2)";
      if (total > 0) {
        var cursor = 0;
        var stops = [];
        parts.forEach(function (part) {
          var value = Number(part.value) || 0;
          if (value === 0) return;
          var from = (cursor / total) * 360;
          cursor += value;
          var to = (cursor / total) * 360;
          stops.push(part.color + " " + from.toFixed(2) + "deg " + to.toFixed(2) + "deg");
        });
        background = "conic-gradient(" + stops.join(",") + ")";
      }
      return h(
        "div",
        { className: "hsp_donut_row" },
        h(
          "div",
          { className: "hsp_donut", style: { background: background } },
          h(
            "div",
            { className: "hsp_donut_center" },
            h("span", { className: "hsp_donut_num" }, num(total)),
            h("span", { className: "hsp_donut_cap" }, props.centerLabel || "节点")
          )
        ),
        h(
          "div",
          { className: "hsp_legend" },
          parts.map(function (part) {
            var percent = total > 0 ? Math.round(((Number(part.value) || 0) / total) * 100) : 0;
            return h(
              "div",
              { className: "hsp_legend_row", key: part.key },
              h("span", { className: "hsp_legend_swatch", style: { background: part.color } }),
              h("span", { className: "hsp_legend_name" }, part.label),
              h("span", { className: "hsp_legend_value" }, num(part.value) + " · " + percent + "%")
            );
          })
        )
      );
    }

    function Sparkline(props) {
      var buckets = props.buckets || [];
      if (buckets.length === 0) return h("div", { className: "hsp_empty" }, "暂无时间序列数据");
      var series = buckets.map(function (bucket) {
        return (Number(bucket.world) || 0) + (Number(bucket.experience) || 0) + (Number(bucket.observation) || 0);
      });
      var max = Math.max.apply(null, series.concat([1]));
      var width = 100;
      var height = 34;
      var step = series.length > 1 ? width / (series.length - 1) : width;
      var points = series.map(function (value, index) {
        return [index * step, height - (value / max) * (height - 3) - 1.5];
      });
      var line = points.map(function (point, index) {
        return (index === 0 ? "M" : "L") + point[0].toFixed(2) + " " + point[1].toFixed(2);
      }).join(" ");
      var area = line + " L" + width.toFixed(2) + " " + height + " L0 " + height + " Z";
      return h(
        "div",
        null,
        h(
          "svg",
          { className: "hsp_spark", viewBox: "0 0 " + width + " " + height, preserveAspectRatio: "none" },
          h("defs", { key: "defs" },
            h("linearGradient", { id: "hsp-spark-fill", x1: "0", y1: "0", x2: "0", y2: "1" },
              h("stop", { offset: "0%", stopColor: "#7c6cf6", stopOpacity: "0.34" }),
              h("stop", { offset: "100%", stopColor: "#7c6cf6", stopOpacity: "0.02" })
            )
          ),
          h("path", { key: "area", d: area, fill: "url(#hsp-spark-fill)", stroke: "none" }),
          h("path", { key: "line", d: line, fill: "none", stroke: "#7c6cf6", strokeWidth: "1.6", vectorEffect: "non-scaling-stroke" })
        ),
        h(
          "div",
          { className: "hsp_row", style: { justifyContent: "space-between", fontSize: 11, color: "var(--dsw-alias-label-secondary)" } },
          h("span", null, fmtDay(buckets[0].time)),
          h("span", null, "峰值 " + num(max) + " 节点 / 天"),
          h("span", null, fmtDay(buckets[buckets.length - 1].time))
        )
      );
    }

    // ---------------------------------------------------------------------
    // model tab
    // ---------------------------------------------------------------------

    function formFromLlm(llm) {
      return {
        provider: llm.provider || "",
        model: llm.model || "",
        baseURL: llm.baseURL || "",
        apiKey: "",
        localProvider: "",
        reasoningEffort: llm.reasoningEffort || "none",
        port: llm.port || 9077,
      };
    }

    function providerById(providers, id) {
      for (var index = 0; index < providers.length; index += 1) {
        if (providers[index].id === id) return providers[index];
      }
      return null;
    }

    function ModelTab(props) {
      var overview = props.overview;
      var providers = (overview && overview.providers) || [];
      var [form, setForm] = useState(null);
      var [saving, setSaving] = useState("");
      var [message, setMessage] = useState(null);
      var [testing, setTesting] = useState(false);
      var [restart, setRestart] = useState(overview ? overview.restart : null);

      useEffect(function () {
        if (!overview) return;
        setRestart(overview.restart);
      }, [overview]);

      useEffect(function () {
        if (!overview) return;
        setForm(function (previous) {
          return previous === null ? formFromLlm(overview.llm) : previous;
        });
      }, [overview]);

      var restartRunning = Boolean(restart && restart.state === "running");
      useEffect(function () {
        if (!restartRunning) return undefined;
        var timer = setInterval(function () {
          api("/restart-status")
            .then(function (data) {
              setRestart(data.restart);
              if (data.restart && data.restart.state !== "running") props.onOverview(true);
            })
            .catch(function () {});
        }, 1200);
        return function () {
          clearInterval(timer);
        };
      }, [restartRunning]);

      if (!overview || !form) {
        return h("div", { className: "hsp_inner" }, h("div", { className: "hsp_skel", style: { width: "40%" } }), h("div", { className: "hsp_card" }, h("div", { className: "hsp_skel", style: { width: "70%" } })));
      }

      var daemon = overview.daemon;
      var current = overview.llm;
      var provider = providerById(providers, form.provider);
      var suggestions = provider && provider.models ? provider.models : [];
      var localProviders = (overview.dsh && overview.dsh.providers ? overview.dsh.providers : []).filter(function (item) {
        return item && item.mappable !== false && item.models && item.models.length > 0;
      });
      var localEntry = null;
      for (var localIndex = 0; localIndex < localProviders.length; localIndex += 1) {
        if (localProviders[localIndex].provider === form.localProvider) localEntry = localProviders[localIndex];
      }

      var update = function (patch) {
        setForm(function (previous) {
          return Object.assign({}, previous, patch);
        });
      };

      var onLocalChange = function (event) {
        var nextId = event.target.value;
        if (nextId === "") {
          update({ localProvider: "" });
          return;
        }
        var entry = null;
        for (var index = 0; index < localProviders.length; index += 1) {
          if (localProviders[index].provider === nextId) entry = localProviders[index];
        }
        if (!entry) {
          update({ localProvider: "" });
          return;
        }
        var firstModel = entry.models && entry.models[0] ? entry.models[0].id : "";
        var hint = entry.hindsight || {};
        update({
          localProvider: entry.provider,
          provider: hint.native === false ? hint.provider || entry.provider : hint.provider || entry.provider,
          model: firstModel,
          baseURL: hint.baseURL || "",
          apiKey: "",
        });
      };

      var onProviderChange = function (event) {
        var nextId = event.target.value;
        var nextProvider = providerById(providers, nextId);
        var patch = { provider: nextId, localProvider: "" };
        if (nextProvider && nextProvider.defaultBaseURL) patch.baseURL = nextProvider.defaultBaseURL;
        if (nextProvider && nextProvider.models && nextProvider.models.length > 0) patch.model = nextProvider.models[0];
        update(patch);
      };

      var save = function (withRestart) {
        setSaving(withRestart ? "restart" : "save");
        setMessage(null);
        var payload = Object.assign({}, form, { restart: withRestart });
        // An untouched password box means "keep the stored key", never "erase it".
        if (!payload.apiKey || String(payload.apiKey).trim() === "") delete payload.apiKey;
        if (!payload.localProvider) delete payload.localProvider;
        api("/save", { method: "POST", body: payload })
          .then(function (data) {
            setForm(function (previous) {
              return Object.assign({}, previous, {
                provider: data.saved.provider,
                model: data.saved.model,
                baseURL: data.saved.baseURL,
                reasoningEffort: data.saved.reasoningEffort || "none",
                apiKey: "",
              });
            });
            if (data.restart) setRestart(data.restart);
            var suffix = "";
            if (data.keyFrom) suffix += " API Key 已从本地凭据 " + data.keyFrom + " 自动写入。";
            if (data.warning) suffix += " " + data.warning;
            setMessage({
              tone: data.warning ? "warn" : "success",
              text:
                (withRestart
                  ? "已写入 profile env，正在重启 daemon。切换期间记忆写入会暂停，约 1–2 分钟。"
                  : "已写入 profile env（未重启，daemon 重启后才生效）。") + suffix,
            });
            props.onOverview(true);
          })
          .catch(function (error) {
            setMessage({ tone: "error", text: String(error.message || error) });
          })
          .finally(function () {
            setSaving("");
          });
      };

      var test = function () {
        setTesting(true);
        setMessage(null);
        var bank = overview.banks && overview.banks.length > 0 ? overview.banks[0].bank_id : undefined;
        api("/test", { method: "POST", body: { bank: bank } })
          .then(function (data) {
            if (data.ok) {
              setMessage({ tone: "success", text: "模型连通：daemon 已用当前配置完成一次真实抽取调用（" + data.llm.provider + " / " + data.llm.model + "）。" });
            } else {
              setMessage({ tone: "error", text: "模型调用失败：" + (data.error || "未知错误") });
            }
          })
          .catch(function (error) {
            setMessage({ tone: "error", text: String(error.message || error) });
          })
          .finally(function () {
            setTesting(false);
          });
      };

      var rollback = function () {
        setSaving("rollback");
        setMessage(null);
        api("/rollback", { method: "POST" })
          .then(function (data) {
            if (data.restart) setRestart(data.restart);
            setMessage({
              tone: "success",
              text: "已回滚到上一次配置（" + (data.saved.provider || "?") + " / " + (data.saved.model || "?") + "），正在重启 daemon。",
            });
            props.onOverview(true);
          })
          .catch(function (error) {
            setMessage({ tone: "error", text: String(error.message || error) });
          })
          .finally(function () {
            setSaving("");
          });
      };

      var restartFailed = Boolean(restart && restart.state === "failed");
      // The badge follows live /health, so it can legitimately say "running"
      // while the last restart attempt is recorded as failed (another process
      // brought the daemon up). Keep both facts visible instead of hiding one.
      var daemonTone = restartRunning ? "warn" : daemon.running ? "ok" : restartFailed ? "off" : "warn";
      var daemonText = restartRunning
        ? "daemon 重启中"
        : daemon.running
          ? restartFailed ? "daemon 运行中 · 上次重启失败" : "daemon 运行中"
          : restartFailed ? "daemon 异常" : "daemon 未运行";

      return h(
        "div",
        { className: "hsp_inner" },
        h(
          "div",
          { className: "hsp_row" },
          h(Pill, { tone: daemonTone, dot: true }, daemonText),
          h(Pill, { tone: "accent" }, current.provider + " / " + current.model),
          h(Pill, { tone: "idle" }, "端口 " + daemon.port),
          daemon.version ? h(Pill, { tone: "idle" }, "hindsight " + daemon.version) : null,
          daemon.running ? null : h("span", { className: "hsp_card_hint" }, "记忆写入依赖 daemon，请先启动或切换后重启。")
        ),

        h(
          Card,
          { title: "当前生效配置", hint: "Hindsight daemon 启动时读取 profile env 文件" },
          h(
            "dl",
            { className: "hsp_kv" },
            h("dt", null, "提供商"),
            h("dd", null, (providerById(providers, current.provider) || {}).label || current.provider || "—", h("span", { className: "hsp_card_hint" }, "  " + (current.provider || ""))),
            h("dt", null, "模型"),
            h("dd", { className: "hsp_mono" }, current.model || "—"),
            h("dt", null, "Base URL"),
            h("dd", { className: "hsp_mono" }, current.baseURL || "默认（由 provider 决定）"),
            h("dt", null, "API Key"),
            h("dd", { className: "hsp_mono" }, current.hasApiKey ? current.apiKeyMasked : "未设置（本地模型可留空）"),
            h("dt", null, "推理强度"),
            h("dd", null, current.reasoningEffort || "none"),
            h("dt", null, "profile"),
            h("dd", { className: "hsp_mono" }, overview.runtime.profile + " · " + overview.runtime.envPath)
          )
        ),

        h(
          Card,
          { title: "切换模型", hint: "写入 env 后需要重启 daemon 才生效" },
          localProviders.length > 0
            ? h(
                "div",
                { className: "hsp_form_grid", style: { marginBottom: 12 } },
                h(
                  Field,
                  {
                    label: "从 DSH 本地配置导入",
                    hint: localEntry ? "模型与凭据都来自本机 DSH 配置" : "本机 DSH 已配置的提供商（含未激活的目录）",
                  },
                  h(
                    "select",
                    { className: "hsp_select", value: form.localProvider || "", onChange: onLocalChange },
                    h("option", { value: "" }, "手动选择（下方目录）"),
                    localProviders.map(function (item) {
                      return h(
                        "option",
                        { key: item.provider, value: item.provider },
                        item.displayName +
                          " · " +
                          item.models.length +
                          " 个模型 · " +
                          (item.keyConfigured ? "凭据已配置" : "无凭据")
                      );
                    })
                  )
                ),
                localEntry
                  ? h(
                      Field,
                      { label: "本地模型", hint: "写入 Hindsight 的 provider：" + localEntry.hindsight.provider },
                      h(
                        "select",
                        { className: "hsp_select hsp_mono", value: form.model, onChange: function (event) { update({ model: event.target.value }); } },
                        localEntry.models.map(function (model) {
                          return h("option", { key: model.id, value: model.id }, model.name + "  (" + model.id + ")");
                        }),
                        localEntry.models.some(function (model) { return model.id === form.model; })
                          ? null
                          : h("option", { value: form.model }, form.model)
                      )
                    )
                  : null
              )
            : null,
          localEntry && !localEntry.keyConfigured
            ? h(
                "div",
                { className: "hsp_callout", "data-tone": "warn", style: { marginBottom: 12 } },
                h("span", { style: { display: "flex", marginTop: 1 } }, h(IconInfo, null)),
                h(
                  "div",
                  { className: "hsp_grow" },
                  "本机没有找到 " + localEntry.provider + " 的凭据（尝试过 " + (localEntry.keyRefs || []).join(" / ") + "）。保存后 Hindsight 仍无法调用该模型。"
                )
              )
            : null,
          h(
            "div",
            { className: "hsp_form_grid" },
            h(
              Field,
              { label: "提供商" },
              h(
                "select",
                { className: "hsp_select", value: form.provider, onChange: onProviderChange },
                providers.map(function (item) {
                  return h("option", { key: item.id, value: item.id }, item.label + "  (" + item.id + ")");
                }),
                providerById(providers, form.provider) ? null : h("option", { value: form.provider }, form.provider)
              )
            ),
            h(
              Field,
              { label: "模型", hint: suggestions.length > 0 ? "常用：" + suggestions.slice(0, 3).join(" / ") : "按提供商填写" },
              h("input", {
                className: "hsp_input",
                list: "hsp-model-options",
                value: form.model,
                placeholder: "例如 deepseek-v4-flash",
                onChange: function (event) { update({ model: event.target.value }); },
              }),
              h(
                "datalist",
                { id: "hsp-model-options" },
                suggestions.map(function (item) { return h("option", { key: item, value: item }); })
              )
            ),
            h(
              Field,
              { label: "Base URL", hint: "留空使用 provider 默认地址" },
              h("input", {
                className: "hsp_input hsp_mono",
                value: form.baseURL,
                placeholder: (provider && provider.defaultBaseURL) || "https://…",
                onChange: function (event) { update({ baseURL: event.target.value }); },
              })
            ),
            h(
              Field,
              { label: "API Key", hint: localEntry ? "留空则自动使用本地凭据 " + (localEntry.keyRef || "（未找到）") : "留空表示保持现有 Key 不变" },
              h("input", {
                className: "hsp_input hsp_mono",
                type: "password",
                value: form.apiKey,
                placeholder: localEntry
                  ? (localEntry.keyConfigured ? "自动：" + localEntry.keyRef : "本地凭据未配置，请手动填写")
                  : current.hasApiKey
                    ? current.apiKeyMasked + "（保持不变）"
                    : "sk-…",
                onChange: function (event) { update({ apiKey: event.target.value }); },
              })
            ),
            h(
              Field,
              { label: "推理强度" },
              h(
                "select",
                { className: "hsp_select", value: form.reasoningEffort, onChange: function (event) { update({ reasoningEffort: event.target.value }); } },
                ((overview && overview.reasoningEfforts) || ["none", "low", "medium", "high"]).map(function (item) {
                  return h("option", { key: item, value: item }, item);
                })
              )
            ),
            h(
              Field,
              { label: "端口", hint: "daemon 监听端口，通常不用改" },
              h("input", {
                className: "hsp_input",
                type: "number",
                min: 1,
                max: 65535,
                value: form.port,
                onChange: function (event) { update({ port: Number(event.target.value) || 9077 }); },
              })
            )
          ),
          h(
            "div",
            { className: "hsp_actions" },
            h(
              "button",
              { className: "hsp_btn hsp_btn_primary", disabled: Boolean(saving) || restartRunning, onClick: function () { save(true); } },
              saving === "restart" ? "正在保存…" : "保存并重启"
            ),
            h(
              "button",
              { className: "hsp_btn", disabled: Boolean(saving) || restartRunning, onClick: function () { save(false); } },
              saving === "save" ? "正在保存…" : "仅保存"
            ),
            h(
              "button",
              { className: "hsp_btn hsp_btn_ghost", disabled: testing || restartRunning || !daemon.running, onClick: test },
              testing ? "测试中…" : "测试连接"
            ),
            h(
              "button",
              { className: "hsp_btn hsp_btn_ghost", disabled: Boolean(saving) || restartRunning, onClick: rollback },
              saving === "rollback" ? "回滚中…" : "回滚上次"
            )
          ),
          h("div", { className: "hsp_callout", "data-tone": "warn", style: { marginTop: 12 } },
            h("span", { style: { display: "flex", marginTop: 1 } }, h(IconInfo, null)),
            h("div", { className: "hsp_grow" },
              "切换模型必须重启 daemon：env 只在启动时读取。一次完整重启约 1–2 分钟（连接验证 + 本地 embedding / reranker 加载），期间记忆写入暂停。"
            )
          )
        ),

        message ? h(Callout, { tone: message.tone, icon: message.tone === "success" ? null : null }, message.text) : null,

        restart && (restart.state === "running" || restart.state === "failed" || restart.state === "ready")
          ? h(
              Card,
              {
                title: "daemon 重启",
                hint: restart.state === "running" ? "进行中" : restart.state === "ready" ? "已完成" : "失败",
                extra: h("span", { className: "hsp_card_hint hsp_nowrap" }, restart.elapsedMs ? fmtDuration(restart.elapsedMs) : ""),
              },
              h(
                "div",
                { className: "hsp_steps" },
                (restart.steps || []).map(function (step) {
                  return h(
                    "div",
                    { className: "hsp_step", key: step.key, "data-state": step.state },
                    h("span", { className: "hsp_step_mark" }, step.state === "done" ? "✓" : step.state === "failed" ? "!" : "•"),
                    h(
                      "div",
                      { className: "hsp_step_body" },
                      h("div", { className: "hsp_step_label" }, step.label),
                      step.detail ? h("div", { className: "hsp_step_detail" }, step.detail) : null
                    )
                  );
                }),
                restart.state === "running" && (restart.steps || []).length === 0
                  ? h("div", { className: "hsp_step_detail hsp_loading_dots" }, "准备中")
                  : null
              ),
              restart.state === "failed"
                ? h(
                    "div",
                    { className: "hsp_callout", "data-tone": daemon.running ? "warn" : "error", style: { marginTop: 10 } },
                    h(
                      "div",
                      { className: "hsp_grow" },
                      daemon.running
                        ? "启动命令报错了，但 daemon 现在已经在运行（通常是另一个窗口或进程同时把它拉了起来）。面板可以直接使用；想干净地重来一次，点下面的「重试重启」。"
                        : restart.error || "重启失败"
                    )
                  )
                : null,
              restart.state === "failed" && restart.logTail ? h("pre", { className: "hsp_pre" }, restart.logTail) : null,
              restart.state === "failed"
                ? h("div", { className: "hsp_actions" }, h("button", { className: "hsp_btn hsp_btn_ghost", onClick: function () { rollback(); } }, "回滚上次配置并重启"), h("button", { className: "hsp_btn hsp_btn_ghost", onClick: function () { api("/restart", { method: "POST" }).then(function (data) { if (data.restart) setRestart(data.restart); }); } }, "重试重启"))
                : null
            )
          : null
      );
    }

    // ---------------------------------------------------------------------
    // memory tab
    // ---------------------------------------------------------------------

    function MemoryCard(props) {
      var item = props.item;
      var [expanded, setExpanded] = useState(false);
      var type = item.type || item.fact_type || "unknown";
      var time = item.mentioned_at || item.occurred_start || item.date;
      var score = item.scores && typeof item.scores.final === "number" ? item.scores.final : null;
      var entities = item.entities;
      if (typeof entities === "string") entities = entities.split(",").filter(function (part) { return part.trim() !== ""; });
      if (!Array.isArray(entities)) entities = [];
      return h(
        "div",
        { className: "hsp_mem", "data-expanded": expanded ? "true" : "false", onClick: function () { setExpanded(!expanded); } },
        h(
          "div",
          { className: "hsp_mem_head" },
          h("span", { className: "hsp_type", "data-type": type }, typeLabel(type)),
          score !== null ? h(Pill, { tone: "idle" }, h("span", { className: "hsp_score" }, score.toFixed(2))) : null,
          item.proof_count > 1 ? h("span", { className: "hsp_tag" }, "证据 ×" + item.proof_count) : null,
          h("span", { className: "hsp_mem_time" }, fmtDate(time))
        ),
        h("p", { className: "hsp_mem_text" }, item.text || "（无文本）"),
        h(
          "div",
          { className: "hsp_mem_meta" },
          (entities || []).slice(0, expanded ? 12 : 4).map(function (entity) {
            return h("span", { className: "hsp_tag", key: String(entity) }, String(entity));
          }),
          item.document_id ? h("span", { className: "hsp_tag", title: item.document_id }, h(IconDoc, { size: 11 }), " 文档") : null
        )
      );
    }

    function EmptyState(props) {
      return h(
        "div",
        { className: "hsp_empty" },
        h("div", { className: "hsp_empty_icon" }, props.icon || h(IconSpark, { size: 20 })),
        h("div", null, props.title),
        props.hint ? h("div", { style: { opacity: 0.8 } }, props.hint) : null
      );
    }

    function MemoryTab(props) {
      var overview = props.overview;
      var banks = (overview && overview.banks) || [];
      var [bank, setBank] = useState("");
      var [sub, setSub] = useState("memories");
      var [stats, setStats] = useState(null);
      var [series, setSeries] = useState(null);
      var [items, setItems] = useState([]);
      var [total, setTotal] = useState(null);
      var [loading, setLoading] = useState(false);
      var [error, setError] = useState("");
      var [search, setSearch] = useState("");
      var [appliedSearch, setAppliedSearch] = useState("");
      var [type, setType] = useState("");
      var [mode, setMode] = useState("keyword");
      var [recallInfo, setRecallInfo] = useState(null);
      var [extras, setExtras] = useState({});
      var requestRef = useRef(0);

      useEffect(function () {
        if (bank === "" && banks.length > 0) setBank(banks[0].bank_id);
      }, [banks, bank]);

      var loadOverviewData = useCallback(function (targetBank) {
        if (!targetBank) return;
        api("/stats" + qs({ bank: targetBank }))
          .then(function (data) { setStats(data.data); })
          .catch(function () {});
        api("/timeseries" + qs({ bank: targetBank, period: "30d" }))
          .then(function (data) { setSeries(data.data); })
          .catch(function () {});
      }, []);

      var loadList = useCallback(function (options) {
        var opts = options || {};
        var targetBank = opts.bank !== undefined ? opts.bank : bank;
        if (!targetBank) return Promise.resolve();
        var nextMode = opts.mode !== undefined ? opts.mode : mode;
        var nextType = opts.type !== undefined ? opts.type : type;
        var nextSearch = opts.search !== undefined ? opts.search : appliedSearch;
        var current = ++requestRef.current;
        setLoading(true);
        setError("");
        var offset = opts.reset ? 0 : items.length;
        var task;
        if (nextMode === "semantic" && nextSearch.trim() !== "") {
          task = api("/recall", { method: "POST", body: { bank: targetBank, query: nextSearch.trim(), limit: PAGE_SIZE } }).then(function (data) {
            var results = (data.data && data.data.results) || [];
            return { items: results, total: null };
          });
        } else {
          task = api("/memories" + qs({ bank: targetBank, type: nextType, q: nextSearch.trim(), limit: PAGE_SIZE, offset: offset })).then(function (data) {
            var payload = data.data || {};
            return { items: payload.items || [], total: payload.total === undefined ? null : payload.total };
          });
        }
        return task
          .then(function (result) {
            if (current !== requestRef.current) return;
            setItems(function (previous) { return opts.reset ? result.items : previous.concat(result.items); });
            setTotal(result.total);
            if (nextMode === "semantic") setRecallInfo({ query: nextSearch, count: result.items.length });
            else setRecallInfo(null);
          })
          .catch(function (err) {
            if (current !== requestRef.current) return;
            setError(String(err.message || err));
          })
          .finally(function () {
            if (current === requestRef.current) setLoading(false);
          });
      }, [bank, items.length, appliedSearch, type, mode]);

      useEffect(function () {
        if (!bank) return;
        loadOverviewData(bank);
        setItems([]);
        setTotal(null);
        loadList({ bank: bank, reset: true, search: "", type: "", mode: "keyword" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [bank]);

      var applySearch = function (nextMode) {
        var next = nextMode || mode;
        if (next === "semantic" && search.trim() === "") return;
        var nextType = next === "semantic" ? "" : type;
        setMode(next);
        setAppliedSearch(search);
        setItems([]);
        setTotal(null);
        loadList({ reset: true, search: search, type: nextType, mode: next, bank: bank });
      };

      var resetSearch = function () {
        setSearch("");
        setAppliedSearch("");
        setRecallInfo(null);
        setMode("keyword");
        setType("");
        setItems([]);
        setTotal(null);
        loadList({ reset: true, search: "", type: "", mode: "keyword", bank: bank });
      };

      var loadExtra = function (key) {
        if (!bank) return;
        setLoading(true);
        setError("");
        var task;
        if (key === "documents") {
          task = api("/documents" + qs({ bank: bank, limit: 30 })).then(function (data) { return { items: (data.data && data.data.items) || [], total: data.data && data.data.total }; });
        } else if (key === "observations") {
          task = api("/memories" + qs({ bank: bank, type: "observation", limit: 30 })).then(function (data) { return { items: (data.data && data.data.items) || [], total: data.data && data.data.total }; });
        } else if (key === "llm") {
          task = Promise.all([
            api("/llm-requests" + qs({ bank: bank, limit: 30 })),
            api("/llm-requests/stats" + qs({ bank: bank, period: "7d" })).catch(function () { return null; }),
          ]).then(function (results) {
            return { items: (results[0].data && results[0].data.items) || [], total: results[0].data && results[0].data.total, stats: results[1] ? results[1].data : null };
          });
        } else if (key === "knowledge") {
          task = api("/knowledge" + qs({ bank: bank })).then(function (data) { return { items: [], total: null, knowledge: data.data }; });
        } else {
          task = Promise.resolve({ items: [], total: 0 });
        }
        task
          .then(function (result) {
            setExtras(function (previous) { return Object.assign({}, previous, { [key]: result }); });
          })
          .catch(function (err) { setError(String(err.message || err)); })
          .finally(function () { setLoading(false); });
      };

      var onSub = function (key) {
        setSub(key);
        if (key === "memories" || key === "observations") {
          setItems([]);
          if (key === "observations") {
            api("/memories" + qs({ bank: bank, type: "observation", limit: 30 }))
              .then(function (data) { setExtras(function (previous) { return Object.assign({}, previous, { observations: { items: (data.data && data.data.items) || [], total: data.data && data.data.total } }); }); })
              .catch(function (err) { setError(String(err.message || err)); });
          } else {
            loadList({ reset: true, search: "", type: "", mode: "keyword", bank: bank });
          }
        } else {
          loadExtra(key);
        }
      };

      if (!banks.length) {
        return h("div", { className: "hsp_inner" }, h(EmptyState, { title: "还没有可用的记忆库", hint: "先在 Hindsight daemon 中产生记忆，或检查 profile 的 bank 配置。" }));
      }

      var nodesByType = (stats && stats.nodes_by_fact_type) || {};
      var parts = ["world", "experience", "observation"].map(function (key) {
        return { key: key, label: typeLabel(key), value: Number(nodesByType[key]) || 0, color: typeColor(key) };
      });
      var linkTypes = (stats && stats.links_by_link_type) || {};
      var llmStats = extras.llm && extras.llm.stats;
      var successCount = 0;
      var errorCount = 0;
      var tokensIn = 0;
      var tokensOut = 0;
      if (llmStats && Array.isArray(llmStats.buckets)) {
        llmStats.buckets.forEach(function (bucket) {
          successCount += (bucket.statuses && bucket.statuses.success) || 0;
          errorCount += (bucket.statuses && bucket.statuses.error) || 0;
          tokensIn += (bucket.tokens && bucket.tokens.input) || 0;
          tokensOut += (bucket.tokens && bucket.tokens.output) || 0;
        });
        successCount += (llmStats.statuses && llmStats.statuses.success) || 0;
        errorCount += (llmStats.statuses && llmStats.statuses.error) || 0;
      }

      var subTabs = [
        { key: "memories", label: "记忆" },
        { key: "documents", label: "文档" },
        { key: "observations", label: "观察" },
        { key: "llm", label: "模型调用" },
        { key: "knowledge", label: "知识页" },
      ];

      return h(
        "div",
        { className: "hsp_inner" },
        h(
          "div",
          { className: "hsp_row" },
          banks.length > 1
            ? h(
                "select",
                { className: "hsp_select", style: { width: 240 }, value: bank, onChange: function (event) { setBank(event.target.value); } },
                banks.map(function (item) { return h("option", { key: item.bank_id, value: item.bank_id }, item.bank_id + " · " + item.fact_count); })
              )
            : h(Pill, { tone: "accent" }, "记忆库 " + bank),
          stats ? h(Pill, { tone: "idle" }, "最近写入 " + fmtDate(stats.last_memory_write_at)) : null,
          h("span", { className: "hsp_grow" }),
          h(
            "button",
            { className: "hsp_btn hsp_btn_ghost hsp_btn_icon", title: "刷新", onClick: function () { loadOverviewData(bank); loadList({ reset: true, search: appliedSearch, type: type, mode: mode, bank: bank }); } },
            h(IconRefresh, null)
          )
        ),

        h(
          "div",
          { className: "hsp_stats" },
          h(Stat, { accent: "links", value: num(stats && stats.total_nodes), label: "记忆节点" }),
          h(Stat, { accent: "observation", value: num(stats && stats.total_observations), label: "观察" }),
          h(Stat, { accent: "experience", value: num(stats && stats.total_links), label: "关联边" }),
          h(Stat, { accent: "world", value: num(stats && stats.total_documents), label: "来源文档" })
        ),

        h(
          "div",
          { className: "hsp_charts" },
          h(Card, { title: "记忆构成", hint: "按事实类型" }, h(Donut, { parts: parts, centerLabel: "节点" })),
          h(
            Card,
            { title: "近 30 天新增", hint: "world + experience + observation" },
            series && Array.isArray(series.buckets) && series.buckets.length > 0
              ? h(Sparkline, { buckets: series.buckets })
              : h("div", { className: "hsp_skel", style: { height: 100, marginTop: 8 } }),
            Object.keys(linkTypes).length > 0
              ? h(
                  "div",
                  { className: "hsp_row", style: { marginTop: 10, fontSize: 11, color: "var(--dsw-alias-label-secondary)" } },
                  Object.keys(linkTypes).map(function (key) {
                    return h("span", { className: "hsp_tag", key: key }, key + " " + num(linkTypes[key]));
                  })
                )
              : null
          )
        ),

        h(
          "div",
          { className: "hsp_chips" },
          subTabs.map(function (item) {
            return h("button", { key: item.key, className: "hsp_chip", "data-active": sub === item.key ? "true" : "false", onClick: function () { onSub(item.key); } }, item.label);
          })
        ),

        error ? h(Callout, { tone: "error" }, error) : null,

        sub === "memories"
          ? h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: 12 } },
              h(
                "div",
                { className: "hsp_search" },
                h(
                  "div",
                  { className: "hsp_search_box" },
                  h("span", { className: "hsp_search_icon" }, h(IconSearch, null)),
                  h("input", {
                    className: "hsp_input",
                    value: search,
                    placeholder: mode === "semantic" ? "用一句话描述你记得什么，例如「模型切换方案」" : "按关键词筛选记忆文本",
                    onChange: function (event) { setSearch(event.target.value); },
                    onKeyDown: function (event) {
                      if (event.key === "Enter") applySearch();
                    },
                  })
                ),
                h("button", { className: "hsp_btn hsp_btn_primary", onClick: function () { applySearch(); }, disabled: loading }, loading ? "查询中…" : "搜索"),
                appliedSearch !== "" || mode === "semantic"
                  ? h("button", { className: "hsp_btn hsp_btn_ghost", onClick: resetSearch }, "清空")
                  : null
              ),
              h(
                "div",
                { className: "hsp_chips" },
                [
                  { id: "", label: "全部" },
                  { id: "world", label: "世界" },
                  { id: "experience", label: "经验" },
                  { id: "observation", label: "观察" },
                ].map(function (option) {
                  return h(
                    "button",
                    {
                      key: option.id || "all",
                      className: "hsp_chip",
                      "data-active": type === option.id && mode === "keyword" ? "true" : "false",
                      onClick: function () {
                        setType(option.id);
                        setMode("keyword");
                        setItems([]);
                        setTotal(null);
                        setAppliedSearch(search);
                        loadList({ reset: true, search: search, type: option.id, mode: "keyword", bank: bank });
                      },
                    },
                    option.label
                  );
                }),
                h("span", { style: { width: 6 } }),
                h(
                  "button",
                  {
                    className: "hsp_chip",
                    "data-active": mode === "semantic" ? "true" : "false",
                    onClick: function () { applySearch("semantic"); },
                    title: "用向量召回 + rerank 做语义搜索",
                  },
                  h("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 } }, h(IconSpark, { size: 11 }), "语义召回")
                )
              ),
              recallInfo ? h(Callout, { tone: "info" }, "语义召回「" + recallInfo.query + "」返回 " + recallInfo.count + " 条结果（按相关度排序）") : null,
              loading && items.length === 0
                ? h(
                    "div",
                    { className: "hsp_mem_grid" },
                    [0, 1, 2, 3].map(function (key) {
                      return h("div", { className: "hsp_mem", key: key }, h("div", { className: "hsp_skel", style: { width: "52%" } }), h("div", { className: "hsp_skel", style: { width: "100%", marginTop: 8 } }), h("div", { className: "hsp_skel", style: { width: "78%", marginTop: 6 } }));
                    })
                  )
                : items.length === 0
                  ? h(EmptyState, { title: "没有匹配的记忆", hint: appliedSearch ? "换个关键词，或试试语义召回" : "这个 bank 还没有记忆，和 agent 聊几句就会产生" })
                  : h("div", { className: "hsp_mem_grid" }, items.map(function (item, index) { return h(MemoryCard, { key: item.id || index, item: item }); })),
              items.length > 0 && mode === "keyword"
                ? h(
                    "div",
                    { className: "hsp_row", style: { justifyContent: "center" } },
                    h(
                      "button",
                      {
                        className: "hsp_btn",
                        disabled: loading || (total !== null && items.length >= total),
                        onClick: function () { loadList({ reset: false, search: appliedSearch, type: type, mode: mode, bank: bank }); },
                      },
                      loading ? "加载中…" : total !== null && items.length >= total ? "已加载全部 " + total + " 条" : "加载更多"
                    )
                  )
                : null
            )
          : null,

        sub === "documents"
          ? h(
              Card,
              { title: "来源文档", hint: extras.documents ? (extras.documents.total || extras.documents.items.length) + " 个" : "加载中" },
              !extras.documents
                ? h("div", { className: "hsp_skel", style: { height: 40 } })
                : extras.documents.items.length === 0
                  ? h(EmptyState, { title: "还没有文档", icon: h(IconDoc, { size: 20 }) })
                  : h(
                      "div",
                      { className: "hsp_list" },
                      extras.documents.items.map(function (doc) {
                        return h(
                          "div",
                          { className: "hsp_list_row", key: doc.id },
                          h("span", { style: { display: "flex", color: "var(--dsw-alias-label-secondary)" } }, h(IconDoc, null)),
                          h("span", { className: "hsp_list_main hsp_mono" }, doc.id),
                          h("span", { className: "hsp_list_meta" }, num(doc.memory_unit_count) + " 段"),
                          h("span", { className: "hsp_list_meta" }, num(doc.text_length) + " 字符"),
                          h("span", { className: "hsp_list_meta" }, fmtDate(doc.updated_at || doc.created_at))
                        );
                      })
                    )
            )
          : null,

        sub === "observations"
          ? h(
              Card,
              { title: "观察", hint: "由具体经验归纳出的稳定结论" },
              !extras.observations
                ? h("div", { className: "hsp_skel", style: { height: 40 } })
                : extras.observations.items.length === 0
                  ? h(EmptyState, { title: "还没有观察" })
                  : h("div", { className: "hsp_mem_grid" }, extras.observations.items.map(function (item, index) { return h(MemoryCard, { key: item.id || index, item: Object.assign({}, item, { type: "observation" }) }); }))
            )
          : null,

        sub === "llm"
          ? h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: 12 } },
              h(
                "div",
                { className: "hsp_stats" },
                h(Stat, { accent: "world", value: num(successCount), label: "近 7 天成功调用" }),
                h(Stat, { accent: "experience", value: num(errorCount), label: "近 7 天失败" }),
                h(Stat, { accent: "observation", value: num(tokensIn), label: "输入 tokens" }),
                h(Stat, { accent: "links", value: num(tokensOut), label: "输出 tokens" })
              ),
              h(
                Card,
                { title: "最近调用", hint: extras.llm ? (extras.llm.total || extras.llm.items.length) + " 条" : "加载中" },
                !extras.llm
                  ? h("div", { className: "hsp_skel", style: { height: 40 } })
                  : h(
                      "div",
                      { className: "hsp_list" },
                      extras.llm.items.map(function (call) {
                        return h(
                          "div",
                          { className: "hsp_list_row", key: call.id },
                          h(Pill, { tone: call.status === "success" ? "ok" : "off" }, call.status),
                          h("span", { className: "hsp_list_main" }, call.operation + " · " + call.scope),
                          h("span", { className: "hsp_list_meta hsp_mono" }, (call.provider || "?") + " / " + (call.model || "?")),
                          h("span", { className: "hsp_list_meta" }, fmtDuration(call.duration_ms)),
                          h("span", { className: "hsp_list_meta" }, fmtDate(call.started_at))
                        );
                      })
                    )
              )
            )
          : null,

        sub === "knowledge"
          ? h(
              Card,
              { title: "知识页", hint: "Hindsight 的 mental models" },
              !extras.knowledge
                ? h("div", { className: "hsp_skel", style: { height: 40 } })
                : (extras.knowledge.knowledge && Array.isArray(extras.knowledge.knowledge.roots) && extras.knowledge.knowledge.roots.length > 0)
                  ? h(
                      "div",
                      { className: "hsp_list" },
                      extras.knowledge.knowledge.roots.map(function (root, index) {
                        return h("div", { className: "hsp_list_row", key: index }, h("span", { className: "hsp_list_main" }, String(root.title || root.name || root.id || "未命名" )));
                      })
                    )
                  : h(EmptyState, {
                      title: "这个记忆库还没有知识页",
                      icon: h(IconSpark, { size: 20 }),
                      hint: "Hindsight 会按需把记忆归纳成知识页（mental models）；产生后这里会列出来。",
                    })
            )
          : null,

        h("div", { className: "hsp_footer" }, "数据来自本机 Hindsight daemon · 由 dsh-hindsight-panel 渲染")
      );
    }

    // ---------------------------------------------------------------------
    // about / uninstall tab
    // ---------------------------------------------------------------------

    function AboutTab(props) {
      var overview = props.overview;
      var [confirming, setConfirming] = useState(false);
      var [busy, setBusy] = useState(false);
      var [result, setResult] = useState(null);

      var uninstall = function () {
        setBusy(true);
        setResult(null);
        api("/uninstall", { method: "POST" })
          .then(function () {
            setResult({ tone: "success", text: "已请求卸载。插件会从 profile 的 bundle 列表移除，刷新本页后侧边栏图标消失。" });
          })
          .catch(function (error) {
            setResult({ tone: "error", text: String(error.message || error) });
          })
          .finally(function () {
            setBusy(false);
            setConfirming(false);
          });
      };

      var runtime = overview ? overview.runtime : null;
      var plugin = overview ? overview.plugin : null;

      return h(
        "div",
        { className: "hsp_inner" },
        h(
          Card,
          { title: "关于", hint: plugin ? plugin.name + " v" + plugin.version : "" },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "var(--dsw-alias-label-secondary)" } },
            h("div", null, "这个面板把 Hindsight 记忆插件的模型配置和记忆内容收进一个侧边栏界面："),
            h("div", null, "· 模型页改写 daemon profile 的 env 文件并重启 daemon（Hindsight 只在该文件里配置 LLM）；"),
            h("div", null, "· 记忆页通过宿主代理读取 daemon 的 REST API，API Key 不会下发到浏览器；"),
            h("div", null, "· 卸载按钮调用 DSH 的 pluginManager 移除本插件自己的 bundle。")
          )
        ),
        runtime
          ? h(
              Card,
              { title: "运行环境" },
              h(
                "dl",
                { className: "hsp_kv" },
                h("dt", null, "模式"),
                h("dd", null, runtime.mode + (runtime.supported ? "" : "（本面板只支持 daemon 模式）")),
                h("dt", null, "profile"),
                h("dd", { className: "hsp_mono" }, runtime.profile),
                h("dt", null, "env 文件"),
                h("dd", { className: "hsp_mono" }, runtime.envPath),
                h("dt", null, "daemon 日志"),
                h("dd", { className: "hsp_mono" }, runtime.logPath),
                h("dt", null, "Hindsight 配置"),
                h("dd", { className: "hsp_mono" }, runtime.settingsPath)
              )
            )
          : null,
        result ? h(Callout, { tone: result.tone }, result.text) : null,
        h(
          Card,
          { title: "卸载", danger: true, hint: "从当前 profile 移除本插件" },
          h("div", { className: "hsp_card_hint", style: { marginBottom: 12 } },
            "卸载不会删除 Hindsight 的记忆数据，也不会改动 daemon 的模型配置；只是把这个面板从 DSH 移除。之后想恢复，重新安装本 bundle 即可。"
          ),
          confirming
            ? h(
                "div",
                { className: "hsp_row" },
                h("span", { className: "hsp_card_hint" }, "确认卸载？"),
                h("button", { className: "hsp_btn hsp_btn_danger", disabled: busy, onClick: uninstall }, busy ? "卸载中…" : "确认卸载"),
                h("button", { className: "hsp_btn hsp_btn_ghost", disabled: busy, onClick: function () { setConfirming(false); } }, "取消")
              )
            : h(
                "div",
                { className: "hsp_row" },
                h("button", { className: "hsp_btn hsp_btn_danger", onClick: function () { setConfirming(true); } }, h(IconTrash, null), "一键卸载插件"),
                h("button", { className: "hsp_btn hsp_btn_ghost", onClick: function () { window.location.reload(); } }, "刷新页面")
              )
        ),
        h("div", { className: "hsp_footer" }, "MIT License · dsh-hindsight-panel")
      );
    }

    // ---------------------------------------------------------------------
    // shell
    // ---------------------------------------------------------------------

    function Header(props) {
      var overview = props.overview;
      var daemon = overview ? overview.daemon : null;
      var llm = overview ? overview.llm : null;
      var tone = !daemon ? "idle" : daemon.running ? "ok" : "off";
      var text = !daemon ? "检查中" : daemon.running ? "daemon 运行中" : "daemon 未运行";
      return h(
        "div",
        { className: "hsp_topbar" },
        h("div", { className: "hsp_badge_icon" }, h(PanelIcon, { size: 22 })),
        h(
          "div",
          { className: "hsp_titles" },
          h("div", { className: "hsp_title" }, "Hindsight 记忆", h(Pill, { tone: tone, dot: true }, text)),
          h(
            "div",
            { className: "hsp_subtitle" },
            llm ? "当前模型 " + (llm.provider || "?") + " / " + (llm.model || "?") : "读取 Hindsight daemon 配置…"
          )
        ),
        h(
          "div",
          { className: "hsp_topbar_actions" },
          overview && overview.plugin ? h(Pill, { tone: "idle" }, "v" + overview.plugin.version) : null,
          h(
            "button",
            { className: "hsp_btn hsp_btn_ghost hsp_btn_icon", title: "刷新", onClick: props.onRefresh, disabled: props.busy },
            h(IconRefresh, null)
          )
        )
      );
    }

    function Panel() {
      var [tab, setTab] = useState("model");
      var [overview, setOverview] = useState(null);
      var [error, setError] = useState("");
      var [busy, setBusy] = useState(false);

      var load = useCallback(function (silent) {
        if (!silent) setBusy(true);
        return api("/overview")
          .then(function (data) {
            setOverview(data);
            setError("");
            return data;
          })
          .catch(function (err) {
            setError(String(err.message || err));
          })
          .finally(function () {
            setBusy(false);
          });
      }, []);

      useEffect(function () {
        load();
        var timer = setInterval(function () { load(true); }, 20000);
        return function () { clearInterval(timer); };
      }, [load]);

      var tabs = [
        { key: "model", label: "模型" },
        { key: "memory", label: "记忆" },
        { key: "about", label: "关于与卸载" },
      ];

      return h(
        "div",
        { className: "hsp_panel" },
        h(Header, { overview: overview, busy: busy, onRefresh: function () { load(); } }),
        h(
          "div",
          { className: "hsp_tabs" },
          tabs.map(function (item) {
            return h(
              "button",
              { key: item.key, className: "hsp_tab", "data-active": tab === item.key ? "true" : "false", onClick: function () { setTab(item.key); } },
              item.label
            );
          })
        ),
        h(
          "div",
          { className: "hsp_scroll" },
          error && !overview ? h("div", { className: "hsp_inner" }, h(Callout, { tone: "error" }, "无法连接宿主半边：" + error)) : null,
          error && overview ? h("div", { className: "hsp_inner" }, h(Callout, { tone: "error" }, error)) : null,
          !overview && !error
            ? h(
                "div",
                { className: "hsp_inner" },
                h("div", { className: "hsp_card" }, h("div", { className: "hsp_skel", style: { width: "35%", height: 18 } }), h("div", { className: "hsp_skel", style: { width: "82%", marginTop: 14 } }), h("div", { className: "hsp_skel", style: { width: "64%", marginTop: 8 } }))
              )
            : null,
          overview && tab === "model" ? h(ModelTab, { overview: overview, onOverview: load }) : null,
          overview && tab === "memory" ? h(MemoryTab, { overview: overview }) : null,
          overview && tab === "about" ? h(AboutTab, { overview: overview }) : null
        )
      );
    }

    // ---------------------------------------------------------------------
    // plugin
    // ---------------------------------------------------------------------

    function reportBootError(error, stage) {
      try {
        var message = error && error.message ? String(error.message) : String(error);
        var stack = error && error.stack ? String(error.stack) : "";
        console.error("[dsh-hindsight-panel] boot failed at", stage, message);
        fetch(API_BASE + "/client-error", {
          method: "POST",
          headers: { "content-type": "application/json", "x-dsh-hindsight-panel": "1" },
          body: JSON.stringify({ stage: stage, message: message, stack: stack }),
        }).catch(function () {});
      } catch (ignored) {
        // Reporting itself failed; nothing sensible left to do.
      }
    }

    // A boot failure here takes the whole DSH window down with it (web boot
    // refuses to continue when an entry does not activate), so the apply is
    // wrapped: report the reason and keep going instead of throwing.
    function showBootBanner(text) {
      try {
        if (document.getElementById("hsp-boot-error") !== null) return;
        var el = document.createElement("div");
        el.id = "hsp-boot-error";
        el.textContent = "[dsh-hindsight-panel] " + text;
        el.style.cssText =
          "position:fixed;left:10px;bottom:10px;z-index:2147483647;max-width:56vw;padding:8px 10px;border-radius:8px;" +
          "background:#7f1d1d;color:#fff;font:12px/1.45 ui-monospace,monospace;white-space:pre-wrap;box-shadow:0 6px 24px rgba(0,0,0,.35)";
        (document.body || document.documentElement).appendChild(el);
      } catch (ignored) {
        // nothing else to do
      }
    }

    function apply(ctx) {
      var disposers = [];
      var stage = "apply:start";
      try {
        applyInner(ctx, disposers, function (next) { stage = next; });
      } catch (error) {
        for (var index = 0; index < disposers.length; index += 1) {
          try {
            disposers[index]();
          } catch (ignored) {
            // already disposed
          }
        }
        disposers.length = 0;
        showBootBanner(stage + " — " + (error && error.message ? error.message : String(error)));
        reportBootError(error, stage);
      }
    }

    function applyInner(ctx, disposers, mark) {
      mark("apply:context");
      if (!ctx || !ctx.slots) {
        throw new Error("slots service unavailable on the client context");
      }
      mark("apply:style");
      ensureStyle();

      // A slot is only registrable once its owning entry has declared it, so
      // registration waits inside slots.inject instead of running immediately.
      mark("apply:inject-panellist");
      disposers.push(
        ctx.slots.inject("sidebar.panellist", function () {
          return ctx.slots.register(
            {
              name: "sidebar.panellist",
              id: PANEL_ID,
              order: PANEL_ORDER,
              label: function () {
                var language = typeof navigator !== "undefined" && navigator.language ? navigator.language : "";
                return /^zh/i.test(language) ? "Hindsight 记忆" : "Hindsight Memory";
              },
            },
            function (ownerProps) {
              var size = ownerProps && typeof ownerProps.size === "number" ? ownerProps.size : 16;
              return h(PanelIcon, { size: size });
            }
          );
        })
      );

      mark("apply:inject-main");
      disposers.push(
        ctx.slots.inject("main", function () {
          return ctx.slots.register(
            { name: "main", key: PANEL_ID },
            function () {
              return h(Panel, null);
            }
          );
        })
      );

      var cleanup = function () {
        for (var index = 0; index < disposers.length; index += 1) {
          try {
            disposers[index]();
          } catch (error) {
            // already disposed
          }
        }
        disposers.length = 0;
      };
      if (typeof ctx.effect === "function") ctx.effect(function () { return cleanup; });
      else if (typeof ctx.on === "function") ctx.on("dispose", cleanup);
      mark("apply:done");
    }

    return { name: "dsh-hindsight-panel", inject: ["slots"], apply: apply };
  },
});
