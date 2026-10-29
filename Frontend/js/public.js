/* Tạo "Giao diện công khai": 1 file HTML độc lập (chứa sẵn dữ liệu) để khán giả xem lịch, kết quả, BXH.
   File này có thể gửi qua Zalo/Messenger hoặc đưa lên bất kỳ hosting tĩnh nào. */
window.PublicPage = (() => {
  "use strict";

  const CSS = `
:root{--bg:#060e22;--card:#0d1b3b;--line:#1c3366;--txt:#e8eefc;--muted:#8ea2c8;--accent:#1f6bff;--gold:#f7b924;--green:#16a34a;--red:#e5283f}
*{box-sizing:border-box}html,body{margin:0}
body{font-family:"Be Vietnam Pro",system-ui,sans-serif;font-size:15px;color:var(--txt);background:radial-gradient(900px 500px at 70% -10%,color-mix(in srgb,var(--accent) 30%,transparent),transparent 60%),var(--bg);min-height:100vh}
.wrap{max-width:1100px;margin:0 auto;padding:0 16px}
.hero{position:relative;overflow:hidden;border-radius:0 0 22px 22px;background:linear-gradient(180deg,#071330,#0b1f4d 60%,#0b3a24) center/cover;padding:34px 16px 28px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.4)}
.hero.img{min-height:260px;display:flex;align-items:flex-end;justify-content:center}
.hero.img::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(3,9,25,.85))}
.hero>*{position:relative;z-index:1}
.hero .logo{width:84px;height:84px;object-fit:contain;filter:drop-shadow(0 6px 18px rgba(0,0,0,.5));margin-bottom:6px}
.hero h1{margin:0;font-family:"Barlow Condensed";font-style:italic;font-weight:800;font-size:clamp(30px,6vw,56px);line-height:1;text-transform:uppercase;
  background:linear-gradient(180deg,#fff7d1,#ffd45a 50%,#f39a00);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 3px 0 #6b3a00)}
.hero p{margin:8px 0 0;color:#dbe5fb}
.meta{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:14px}
.meta span{padding:7px 12px;border-radius:999px;background:rgba(5,12,30,.7);border:1px solid rgba(255,255,255,.14);font-size:13px}
.tabs{position:sticky;top:0;z-index:5;display:flex;gap:6px;overflow:auto;padding:12px 0;background:linear-gradient(var(--bg) 70%,transparent)}
.tabs a{flex:none;padding:10px 16px;border-radius:10px;border:1px solid var(--line);color:#cfdaf3;text-decoration:none;font-weight:600;font-size:14px;transition:all .2s}
.tabs a:hover{border-color:#4d7ad6;transform:translateY(-1px)}
.tabs a.on{background:var(--accent);border-color:transparent;color:#fff;box-shadow:0 6px 18px color-mix(in srgb,var(--accent) 50%,transparent)}
.tools{display:flex;gap:8px;align-items:center;margin:4px 0 12px;flex-wrap:wrap}
select{padding:9px 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--txt);font:inherit}
.day{margin:18px 0 8px;font-weight:800;color:var(--gold);text-transform:uppercase;font-size:13px;letter-spacing:.5px}
.m{display:grid;grid-template-columns:70px 1fr auto 1fr;gap:10px;align-items:center;padding:12px;border-radius:12px;background:var(--card);border:1px solid var(--line);margin-bottom:8px;transition:transform .2s,border-color .2s}
.m:hover{transform:translateY(-2px);border-color:#2b4c8f}
.m .when{font-size:12px;color:var(--muted);line-height:1.4}
.m .when b{display:block;color:var(--txt);font-size:15px}
.t{display:flex;align-items:center;gap:8px;font-weight:600;min-width:0}
.t span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.t.r{justify-content:flex-end;text-align:right}
.t img{width:30px;height:30px;object-fit:contain;flex:none}
.t.ph{color:var(--muted);font-weight:500;font-style:italic}
.sc{min-width:64px;text-align:center;font-family:"Barlow Condensed";font-weight:800;font-size:24px;padding:2px 10px;border-radius:8px;background:#3a0a40}
.sc.vs{background:transparent;color:var(--muted);font-size:16px}
.sc small{display:block;font-size:11px;font-family:"Be Vietnam Pro";font-weight:600;color:#ffd45a}
.st{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--muted)}
.b{display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;border:1px solid var(--line)}
.b.live{color:#ff8d9c;border-color:rgba(229,40,63,.6);background:rgba(229,40,63,.15)}
.b.post{color:var(--gold);border-color:rgba(247,185,36,.5);background:rgba(247,185,36,.12)}
.b.done{color:#6ee79a;border-color:rgba(22,163,74,.5);background:rgba(22,163,74,.12)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:14px;overflow:auto}
.card h3{margin:0 0 10px;text-transform:uppercase;font-size:15px}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;color:var(--muted);font-size:12px;font-weight:600;padding:8px 6px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:8px 6px;border-bottom:1px solid rgba(40,74,140,.35);white-space:nowrap}
.c{text-align:center}tr.q td:first-child{box-shadow:inset 3px 0 0 var(--green)}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr))}
.br{display:flex;gap:18px;overflow:auto;padding-bottom:6px}
.br .col{min-width:200px;display:flex;flex-direction:column;justify-content:space-around;gap:10px}
.br h4{margin:0;text-align:center;font-size:12px;color:var(--muted);text-transform:uppercase}
.bm{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#0a1834}
.bm div{display:flex;gap:8px;align-items:center;padding:7px 10px}.bm div+div{border-top:1px solid var(--line)}
.bm span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bm img{width:22px;height:22px;object-fit:contain}
.bm .w{background:rgba(22,163,74,.18);font-weight:700}
.news{padding:14px;border-radius:12px;background:var(--card);border:1px solid var(--line);margin-bottom:10px}
.news h4{margin:0 0 6px}.news p{margin:0;white-space:pre-wrap;color:#c7d3ef}.news small{color:var(--muted)}
.empty{padding:30px;text-align:center;color:var(--muted)}
footer{text-align:center;color:var(--muted);font-size:12px;padding:26px 0 40px}
@media (max-width:640px){.m{grid-template-columns:1fr auto 1fr}.m .when{grid-column:1/-1;display:flex;gap:8px}.m .when b{display:inline;font-size:13px}.t img{width:24px;height:24px}}
`;

  // Hàm này chạy BÊN TRONG trang công khai (được nhúng dạng chuỗi).
  function RENDER() {
    var D = window.DATA, app = document.getElementById("app");
    var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    document.documentElement.style.setProperty("--accent", D.accent || "#1f6bff");
    var tabs = [["lich", "Lịch thi đấu"], ["ketqua", "Kết quả"], ["bxh", "Bảng xếp hạng"], ["thongke", "Thống kê"], ["thongbao", "Thông báo"]];
    var team = "";
    function tm(x, right) {
      if (!x.name) return '<div class="t ph ' + (right ? "r" : "") + '"><span>' + esc(x.label) + "</span></div>";
      return right ? '<div class="t r"><span>' + esc(x.name) + '</span><img src="' + x.logo + '" alt=""></div>' : '<div class="t"><img src="' + x.logo + '" alt=""><span>' + esc(x.name) + "</span></div>";
    }
    function match(m) {
      var sc = m.status === "done" || m.status === "live"
        ? '<div class="sc">' + m.hs + " - " + m.as + (m.pens ? "<small>pen " + m.pens + "</small>" : "") + "</div>" : '<div class="sc vs">VS</div>';
      var badge = m.status === "live" ? '<span class="b live">● Đang đá</span>' : m.status === "postponed" ? '<span class="b post">Hoãn' + (m.note ? ": " + esc(m.note) : "") + "</span>" : m.status === "done" ? '<span class="b done">Kết thúc</span>' : "";
      var goals = m.goals.length ? "⚽ " + m.goals.map(esc).join(", ") : "";
      return '<div class="m"><div class="when"><b>' + esc(m.time || "--:--") + "</b>Sân " + m.pitch + "</div>" + tm(m.home, true) + sc + tm(m.away) +
        '<div class="st"><span class="b">' + esc(m.stage) + "</span>" + badge + (goals ? "<span>" + goals + "</span>" : "") + "</div></div>";
    }
    function list(ms) {
      if (team) ms = ms.filter(function (m) { return m.home.code === team || m.away.code === team; });
      if (!ms.length) return '<div class="empty">Không có trận đấu</div>';
      var out = "", last = null;
      ms.forEach(function (m) { if (m.dayLabel !== last) { out += '<div class="day">' + esc(m.dayLabel) + "</div>"; last = m.dayLabel; } out += match(m); });
      return out;
    }
    function filter() {
      return '<div class="tools"><select id="tf"><option value="">Tất cả các đội</option>' + D.teams.map(function (t) { return '<option value="' + esc(t.code) + '"' + (t.code === team ? " selected" : "") + ">" + esc(t.code + " - " + t.name) + "</option>"; }).join("") + "</select></div>";
    }
    function table(head, rows) { return "<table><thead><tr>" + head.map(function (h, i) { return "<th" + (i > 1 ? ' class="c"' : "") + ">" + h + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.join("") + "</tbody></table>"; }
    function tcell(t) { return '<div class="t"><img src="' + t.logo + '" alt=""><span>' + esc(t.name) + "</span></div>"; }
    var views = {
      lich: function () { return filter() + list(D.matches.filter(function (m) { return m.status !== "done"; })); },
      ketqua: function () { return filter() + list(D.matches.filter(function (m) { return m.status === "done"; }).reverse()); },
      bxh: function () {
        var g = D.groups.length ? '<div class="grid">' + D.groups.map(function (g) {
          return '<div class="card"><h3>' + esc(g.title) + "</h3>" + table(["#", "Đội", "ST", "T", "H", "B", "HS", "Đ"], g.rows.map(function (r, i) {
            return '<tr class="' + (r.q ? "q" : "") + '"><td>' + (i + 1) + "</td><td>" + tcell(r) + '</td><td class="c">' + r.p + '</td><td class="c">' + r.w + '</td><td class="c">' + r.d + '</td><td class="c">' + r.l + '</td><td class="c">' + (r.gd > 0 ? "+" : "") + r.gd + '</td><td class="c"><b>' + r.pts + "</b></td></tr>";
          })) + "</div>";
        }).join("") + "</div>" : "";
        var b = D.bracket.length ? '<div class="card"><h3>Nhánh đấu knock-out</h3><div class="br">' + D.bracket.map(function (c) {
          return '<div class="col"><h4>' + esc(c.label) + "</h4>" + c.matches.map(function (m) {
            var row = function (x, s, w) { return '<div class="' + (w ? "w" : "") + '">' + (x.name ? '<img src="' + x.logo + '" alt=""><span>' + esc(x.name) + "</span>" : '<span style="color:var(--muted);font-style:italic">' + esc(x.label) + "</span>") + "<b>" + (s == null ? "" : s) + "</b></div>"; };
            return '<div class="bm">' + row(m.home, m.hs, m.winner === "home") + row(m.away, m.as, m.winner === "away") + "</div>";
          }).join("") + "</div>";
        }).join("") + "</div></div>" : "";
        return (g + b) || '<div class="empty">Chưa có bảng xếp hạng</div>';
      },
      thongke: function () {
        var s = '<div class="card"><h3>👟 Vua phá lưới</h3>' + (D.scorers.length ? table(["#", "Cầu thủ", "Đội", "Bàn"], D.scorers.map(function (r, i) {
          return "<tr><td>" + (i + 1) + "</td><td>" + esc(r.name) + "</td><td>" + tcell(r.team) + '</td><td class="c"><b>' + r.goals + "</b></td></tr>"; })) : '<div class="empty">Chưa có bàn thắng</div>') + "</div>";
        var c = '<div class="card"><h3>🟨 Thẻ phạt</h3>' + (D.cards.length ? table(["#", "Cầu thủ", "Đội", "Vàng", "Đỏ"], D.cards.map(function (r, i) {
          return "<tr><td>" + (i + 1) + "</td><td>" + esc(r.name) + "</td><td>" + tcell(r.team) + '</td><td class="c">' + r.yellow + '</td><td class="c">' + r.red + "</td></tr>"; })) : '<div class="empty">Chưa có thẻ phạt</div>') + "</div>";
        var b = D.bans.length ? '<div class="card"><h3>⛔ Cầu thủ bị treo giò</h3>' + table(["#", "Cầu thủ", "Đội", "Trận bị cấm", "Lý do"], D.bans.map(function (r, i) {
          return "<tr><td>" + (i + 1) + "</td><td>" + esc(r.name) + "</td><td>" + tcell(r.team) + "</td><td>" + esc(r.match) + "</td><td>" + esc(r.reason) + "</td></tr>"; })) + "</div>" : "";
        return '<div class="grid">' + s + c + "</div>" + b;
      },
      thongbao: function () {
        return D.news.length ? D.news.map(function (n) { return '<div class="news"><small>' + esc(n.date) + "</small><h4>" + esc(n.title) + "</h4><p>" + esc(n.body) + "</p></div>"; }).join("") : '<div class="empty">Chưa có thông báo</div>';
      }
    };
    function draw() {
      var cur = (location.hash || "#lich").slice(1); if (!views[cur]) cur = "lich";
      app.innerHTML =
        '<header class="hero ' + (D.banner ? "img" : "") + '"' + (D.banner ? ' style="background-image:url(' + D.banner + ')"' : "") + "><div>" +
          (D.logo ? '<img class="logo" src="' + D.logo + '" alt="">' : "") + "<h1>" + esc(D.name) + "</h1>" + (D.slogan ? "<p>" + esc(D.slogan) + "</p>" : "") +
          '<div class="meta"><span>📅 ' + esc(D.range) + "</span><span>📍 " + esc(D.venue) + "</span><span>👥 " + D.teams.length + " đội</span><span>⚽ " + D.played + "/" + D.total + " trận</span></div></div></header>" +
        '<div class="wrap"><nav class="tabs">' + tabs.map(function (t) { return '<a href="#' + t[0] + '" class="' + (t[0] === cur ? "on" : "") + '">' + t[1] + "</a>"; }).join("") + "</nav>" +
        "<main>" + views[cur]() + "</main><footer>" + (D.org ? esc(D.org) + " · " : "") + "Cập nhật lúc " + esc(D.updated) + "</footer></div>";
      var tf = document.getElementById("tf"); if (tf) tf.onchange = function () { team = tf.value; draw(); };
    }
    window.addEventListener("hashchange", draw);
    draw();
  }

  function build(D) {
    const e = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(D.name)}</title><meta name="description" content="Lịch thi đấu, kết quả và bảng xếp hạng ${e(D.name)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800&family=Barlow+Condensed:ital,wght@1,800&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body><div id="app"></div>
<script>window.DATA=${JSON.stringify(D).replace(/</g, "\\u003c")};(${RENDER.toString()})();<\/script></body></html>`;
  }

  return { build };
})();
