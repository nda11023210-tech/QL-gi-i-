/* Phần tính toán: chia bảng, xếp lịch, bảng xếp hạng, nhánh knock-out, thống kê.
   Không đụng tới giao diện. */
const L = (() => {
  "use strict";

  const uid = () => Math.random().toString(36).slice(2, 10);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const byCode = (a, b) => String(a.code).localeCompare(String(b.code), "vi", { numeric: true });
  const GROUP_NAMES = "ABCDEFGHIJKLMNOP";
  const STAGES = { group: "Vòng bảng", rr: "Vòng tròn", r64: "Vòng 1/32", r32: "Vòng 1/16", r16: "Vòng 1/8", qf: "Tứ kết", sf: "Bán kết", third: "Tranh hạng 3", final: "Chung kết" };
  const KO_BY_SIZE = { 2: "final", 4: "sf", 8: "qf", 16: "r16", 32: "r32", 64: "r64" };

  /* ---------- ngày giờ ---------- */
  const pad = n => String(n).padStart(2, "0");
  const parseISO = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const addMinutes = (hhmm, min) => { const [h, m] = String(hhmm || "00:00").split(":").map(Number); const t = h * 60 + m + min; return pad(Math.floor(t / 60) % 24) + ":" + pad(t % 60); };

  /* ---------- chia bảng ---------- */
  function draw(T) {
    const f = T.format, teams = T.teams.slice().sort(byCode);
    const team = id => T.teams.find(t => t.id === id);
    // vòng tròn: rrSize = 0 → tất cả 1 bảng; rrSize = 4 → chia thành các bảng 4 đội, đá vòng tròn trong bảng
    const rrSize = +f.rrSize || 0;
    if (f.type === "rr" && (!rrSize || teams.length <= rrSize)) return [{ name: "Chung", teamIds: teams.map(t => t.id) }];
    if (f.type === "ko") { T.koOrder = (f.random ? shuffle(teams) : teams).map(t => t.id); return []; }

    const G = f.type === "rr" ? Math.ceil(teams.length / rrSize) : Math.max(1, Math.min(+f.groups || 1, teams.length || 1));
    const groups = Array.from({ length: G }, (_, i) => ({ name: GROUP_NAMES[i], teamIds: [] }));

    if (!f.random) {
      // theo thứ tự mã đội: A1→bảng A, A2→bảng B, ...
      teams.forEach((t, i) => groups[i % G].teamIds.push(t.id));
    } else if (f.drawMethod === "seed") {
      // mỗi "nhóm hạt giống" gồm G đội liền mã, mỗi bảng nhận đúng 1 đội của mỗi nhóm
      for (let p = 0; p < teams.length; p += G) {
        const order = shuffle(groups.map((_, i) => i));
        shuffle(teams.slice(p, p + G)).forEach((t, i) => groups[order[i]].teamIds.push(t.id));
      }
    } else if (f.drawMethod === "region") {
      // rải đều các đội cùng khu vực sang các bảng khác nhau
      const cap = Math.ceil(teams.length / G), count = {};
      teams.forEach(t => { const r = t.region || ""; count[r] = (count[r] || 0) + 1; });
      shuffle(teams).sort((a, b) => count[b.region || ""] - count[a.region || ""]).forEach(t => {
        const r = t.region || "";
        let best = null, bestScore = Infinity;
        shuffle(groups).forEach(g => {
          if (g.teamIds.length >= cap) return;
          const same = r ? g.teamIds.filter(id => (team(id).region || "") === r).length : 0;
          const score = same * 100 + g.teamIds.length;
          if (score < bestScore) { bestScore = score; best = g; }
        });
        best.teamIds.push(t.id);
      });
    } else {
      shuffle(teams).forEach((t, i) => groups[i % G].teamIds.push(t.id));
    }
    groups.forEach(g => g.teamIds.sort((a, b) => byCode(team(a), team(b))));
    return groups;
  }

  /* ---------- vòng tròn (thuật toán xoay vòng) ---------- */
  function roundRobin(ids) {
    const a = ids.slice();
    if (a.length % 2) a.push(null);
    const n = a.length, rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const h = a[i], w = a[n - 1 - i];
        if (h && w) pairs.push(r % 2 && i === 0 ? [w, h] : [h, w]);
      }
      rounds.push(pairs);
      a.splice(1, 0, a.pop());
    }
    return rounds;
  }

  /* ---------- tạo danh sách trận ---------- */
  function newMatch(o) {
    return Object.assign({ id: uid(), home: null, away: null, hs: null, as: null, ph: null, pa: null,
      status: "pending", events: [], date: "", time: "", pitch: 1 }, o);
  }

  // trả về các "giai đoạn"; mỗi giai đoạn được xếp lịch bắt đầu từ một ngày mới
  function buildPhases(T) {
    const f = T.format, S = T.sched, phases = [];
    const team = id => T.teams.find(t => t.id === id);

    if (f.type !== "ko") {
      const stage = f.type === "rr" ? "rr" : "group";
      const per = T.groups.map(g => roundRobin(g.teamIds));
      const maxR = Math.max(0, ...per.map(r => r.length));
      const list = [];
      const push = (g, r, p) => list.push(newMatch({ stage, group: g.name, round: r + 1, home: p[0], away: p[1] }));
      if (S.balance) { for (let r = 0; r < maxR; r++) T.groups.forEach((g, gi) => (per[gi][r] || []).forEach(p => push(g, r, p))); }
      else T.groups.forEach((g, gi) => per[gi].forEach((pairs, r) => pairs.forEach(p => push(g, r, p))));
      if (S.orderByCode) {
        const rank = new Map(list.map((m, i) => [m, i]));
        list.sort((a, b) => (S.balance ? a.round - b.round : 0) || (S.balance ? byCode(team(a.home), team(b.home)) : rank.get(a) - rank.get(b)));
      }
      phases.push(list);
    }

    let pairs = null;
    if ((f.type === "groups" || f.type === "custom") && +f.advance > 0 && T.groups.length) pairs = pairsFromGroups(T);
    else if (f.type === "ko") {
      const order = (T.koOrder && T.koOrder.length === T.teams.length && T.koOrder.every(id => team(id)))
        ? T.koOrder : T.teams.slice().sort(byCode).map(t => t.id);
      pairs = seedPairs(order.map(id => ({ type: "team", id })));
    }
    if (pairs && pairs.length) phases.push(...bracket(pairs, f.third));
    return phases;
  }

  function pairsFromGroups(T) {
    const G = T.groups.length, q = Math.max(1, Math.min(+T.format.advance || 1, ...T.groups.map(g => g.teamIds.length)));
    const s = (g, r) => ({ type: "group", group: T.groups[g].name, rank: r });
    if (G % 2 === 0 && q <= 2) {
      // bắt chéo: Nhất A - Nhì B ở nửa trên, Nhất B - Nhì A ở nửa dưới
      // (2 đội cùng bảng chỉ có thể gặp lại ở chung kết)
      const top = [], bot = [];
      for (let k = 0; k < G; k += 2) {
        if (q === 2) { top.push([s(k, 1), s(k + 1, 2)]); bot.push([s(k + 1, 1), s(k, 2)]); }
        else top.push([s(k, 1), s(k + 1, 1)]);
      }
      return top.concat(bot);
    }
    const seeds = [];
    for (let r = 1; r <= q; r++) for (let g = 0; g < G; g++) seeds.push(s(g, r));
    return seedPairs(seeds);
  }

  // hạt giống 1 gặp hạng chót, 2 gặp áp chót...; thiếu đội thì hạt giống cao được miễn đấu
  function seedPairs(seeds) {
    if (seeds.length < 2) return [];
    let size = 1; while (size < seeds.length) size *= 2;
    const slots = seeds.concat(Array(size - seeds.length).fill(null)), pairs = [];
    for (let i = 0; i < size / 2; i++) pairs.push([slots[i], slots[size - 1 - i]]);
    return pairs;
  }

  function bracket(pairs, third) {
    const phases = [];
    let cur = pairs.map(([h, a]) => newMatch({ stage: KO_BY_SIZE[pairs.length * 2] || "r" + pairs.length * 2, src: { home: h, away: a } }));
    let thirdMatch = null;
    for (;;) {
      if (cur.length === 1) { phases.push(thirdMatch ? [thirdMatch, cur[0]] : cur); break; }
      phases.push(cur);
      const next = [];
      for (let i = 0; i < cur.length; i += 2) {
        next.push(newMatch({ stage: KO_BY_SIZE[cur.length] || "r" + cur.length,
          src: { home: { type: "win", match: cur[i].id }, away: { type: "win", match: cur[i + 1].id } } }));
      }
      if (next.length === 1 && third) {
        thirdMatch = newMatch({ stage: "third", src: { home: { type: "lose", match: cur[0].id }, away: { type: "lose", match: cur[1].id } } });
      }
      cur = next;
    }
    return phases;
  }

  /* ---------- xếp ngày, giờ, sân ---------- */
  function assignDates(phases, S) {
    const pitches = Math.max(1, +S.pitches || 1), perDay = Math.max(1, +S.perDay || 1);
    const slotsPerDay = Math.ceil(perDay / pitches), gap = +S.gap || 90;
    const keys = m => [m.home || "?h" + m.id, m.away || "?a" + m.id];
    let day = parseISO(S.start), last = null;

    phases.forEach(list => {
      const queue = list.filter(m => !isBye(m));
      let guard = 0;
      while (queue.length && guard++ < 1000) {
        const playedToday = new Map(); let prev = new Set(), count = 0;
        for (let s = 0; s < slotsPerDay && count < perDay && queue.length; s++) {
          const cur = new Set(), time = addMinutes(S.time, s * gap);
          for (let p = 1; p <= pitches && count < perDay; p++) {
            const i = queue.findIndex(m => keys(m).every(k =>
              !cur.has(k) && !(S.noBackToBack && (prev.has(k) || playedToday.has(k)))));
            if (i < 0) break;
            const m = queue.splice(i, 1)[0];
            m.date = iso(day); m.time = time; m.pitch = p;
            keys(m).forEach(k => { cur.add(k); playedToday.set(k, 1); });
            count++;
          }
          prev = cur;
        }
        if (count) last = new Date(day);
        day = addDays(day, 1);
      }
    });
    return last ? iso(last) : S.start;
  }

  function isBye(m) { return !!m.src && ((m.src.home === null) !== (m.src.away === null)); }

  /* ---------- kết quả, bảng xếp hạng ---------- */
  function winner(m) {
    if (m.bye) return m.home || m.away;
    if (m.status !== "done" || m.hs == null || m.as == null || !m.home || !m.away) return null;
    if (+m.hs !== +m.as) return +m.hs > +m.as ? m.home : m.away;
    if (m.ph != null && m.pa != null && +m.ph !== +m.pa) return +m.ph > +m.pa ? m.home : m.away;
    return null;
  }
  function loser(m) { const w = winner(m); if (!w || m.bye) return null; return w === m.home ? m.away : m.home; }

  const isGroupStage = m => m.stage === "group" || m.stage === "rr";
  function groupDone(T, g) {
    const ms = T.matches.filter(m => isGroupStage(m) && m.group === g);
    return ms.length > 0 && ms.every(m => m.status === "done");
  }

  function standings(T, gname) {
    const g = T.groups.find(x => x.name === gname); if (!g) return [];
    const P = T.settings, team = id => T.teams.find(t => t.id === id) || { code: "" };
    const rows = g.teamIds.map(id => ({ id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [] }));
    const R = Object.fromEntries(rows.map(r => [r.id, r]));
    T.matches.forEach(m => {
      if (!isGroupStage(m) || m.group !== gname || m.status !== "done" || m.hs == null || m.as == null) return;
      const h = R[m.home], a = R[m.away]; if (!h || !a) return;
      const hs = +m.hs, as = +m.as;
      h.p++; a.p++; h.gf += hs; h.ga += as; a.gf += as; a.ga += hs;
      if (hs > as) { h.w++; a.l++; h.form.push("W"); a.form.push("L"); }
      else if (hs < as) { a.w++; h.l++; h.form.push("L"); a.form.push("W"); }
      else { h.d++; a.d++; h.form.push("D"); a.form.push("D"); }
    });
    rows.forEach(r => { r.gd = r.gf - r.ga; r.pts = r.w * +P.win + r.d * +P.draw + r.l * +P.loss; });
    rows.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || headToHead(T, gname, x.id, y.id) || byCode(team(x.id), team(y.id)));
    return rows;
  }
  function headToHead(T, g, a, b) {
    let s = 0;
    T.matches.forEach(m => {
      if (!isGroupStage(m) || m.group !== g || m.status !== "done") return;
      if (m.home === a && m.away === b) s += Math.sign(+m.as - +m.hs);
      if (m.home === b && m.away === a) s += Math.sign(+m.hs - +m.as);
    });
    return s;
  }

  // điền đội vào các trận knock-out từ BXH / đội thắng trận trước
  function resolve(T) {
    const byId = Object.fromEntries(T.matches.map(m => [m.id, m])), cache = {};
    const from = s => {
      if (!s) return null;
      if (s.type === "team") return s.id;
      if (s.type === "group") {
        if (!groupDone(T, s.group)) return null;
        const st = cache[s.group] || (cache[s.group] = standings(T, s.group));
        return st[s.rank - 1] ? st[s.rank - 1].id : null;
      }
      const src = byId[s.match]; if (!src) return null;
      return s.type === "win" ? winner(src) : loser(src);
    };
    T.matches.forEach(m => {
      if (!m.src) return;
      m.home = from(m.src.home); m.away = from(m.src.away);
      m.bye = isBye(m);
      if (m.bye) m.status = "done";
    });
  }

  function srcLabel(T, s) {
    if (!s) return "Miễn đấu";
    if (s.type === "team") return "";
    if (s.type === "group") return (s.rank === 1 ? "Nhất" : s.rank === 2 ? "Nhì" : s.rank === 3 ? "Ba" : "Hạng " + s.rank) + " bảng " + s.group;
    const n = T.matches.filter(x => !x.bye).findIndex(x => x.id === s.match) + 1;
    return (s.type === "win" ? "Thắng" : "Thua") + " trận " + (n || "?");
  }

  /* ---------- thống kê cá nhân ---------- */
  function playerStats(T) {
    const map = new Map();
    T.matches.forEach(m => (m.events || []).forEach(e => {
      const teamId = e.side === "home" ? m.home : m.away;
      if (!teamId || !e.player) return;
      const key = teamId + "|" + e.player.trim().toLowerCase();
      const r = map.get(key) || { teamId, name: e.player.trim(), goals: 0, yellow: 0, red: 0 };
      if (e.type === "goal") r.goals++;
      if (e.type === "yellow") r.yellow++;
      if (e.type === "red") r.red++;
      map.set(key, r);
    }));
    return [...map.values()];
  }

  /* ---------- thẻ phạt & án treo giò ----------
     Thẻ ở trận N → bị cấm ở (các) trận tiếp theo của đội. Trả về từng cầu thủ kèm danh sách trận bị cấm. */
  const byTime = (a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.time || "").localeCompare(b.time || "") || (a.pitch || 0) - (b.pitch || 0);
  function discipline(T) {
    const S = T.settings, yN = Math.max(1, +S.yellowBan || 2), yG = Math.max(1, +S.yellowBanGames || 1), rG = Math.max(1, +S.redBanGames || 1);
    const recs = new Map();
    const rec = (teamId, name) => {
      const k = teamId + "|" + String(name).trim().toLowerCase();
      if (!recs.has(k)) recs.set(k, { key: k, teamId, name: String(name).trim(), yellow: 0, red: 0, acc: 0, queue: [], bans: [], violations: [], manual: [] });
      return recs.get(k);
    };
    (T.bans || []).forEach(b => { if (b.player && b.teamId) rec(b.teamId, b.player).manual.push(b); });
    T.teams.forEach(t => {
      const ms = T.matches.filter(m => !m.bye && (m.home === t.id || m.away === t.id)).sort(byTime);
      const own = () => [...recs.values()].filter(r => r.teamId === t.id);
      const applied = new Set();
      ms.forEach(m => {
        own().forEach(r => r.manual.forEach(b => {
          if (applied.has(b.id) || (m.date && b.from && m.date < b.from)) return;
          applied.add(b.id);
          for (let i = 0; i < Math.max(1, +b.games || 1); i++) r.queue.push(b.reason || "Kỷ luật của BTC");
        }));
        if (m.status === "postponed") return;
        own().forEach(r => { if (r.queue.length) r.bans.push({ matchId: m.id, reason: r.queue.shift() }); });
        if (m.status !== "done") return;
        const side = m.home === t.id ? "home" : "away", per = new Map();
        (m.events || []).forEach(e => {
          if (e.side !== side || !e.player || !String(e.player).trim() || (e.type !== "yellow" && e.type !== "red")) return;
          const r = rec(t.id, e.player), p = per.get(r) || { y: 0, red: 0 };
          if (e.type === "yellow") p.y++; else p.red++;
          per.set(r, p);
        });
        (m.events || []).forEach(e => {
          if (e.side !== side || !e.player || !String(e.player).trim()) return;
          const r = rec(t.id, e.player);
          if (r.bans.some(b => b.matchId === m.id) && !r.violations.includes(m.id)) r.violations.push(m.id);
        });
        per.forEach((p, r) => {
          r.yellow += p.y; r.red += p.red;
          if (p.red) { for (let i = 0; i < rG; i++) r.queue.push("Thẻ đỏ"); }
          else if (p.y >= 2) { for (let i = 0; i < rG; i++) r.queue.push("2 thẻ vàng trong 1 trận"); }
          else if (p.y) { r.acc += p.y; if (r.acc >= yN) { r.acc = 0; for (let i = 0; i < yG; i++) r.queue.push(`Tích lũy ${yN} thẻ vàng`); } }
        });
      });
      // án chưa xếp được vào trận nào (đội chưa có lịch tiếp theo)
      own().forEach(r => r.manual.forEach(b => { if (!applied.has(b.id)) { applied.add(b.id); for (let i = 0; i < Math.max(1, +b.games || 1); i++) r.queue.push(b.reason || "Kỷ luật của BTC"); } }));
    });
    return [...recs.values()];
  }

  /* ---------- kiểm tra trùng lịch ---------- */
  function conflicts(T) {
    const out = [], ms = T.matches.filter(m => !m.bye && m.status !== "postponed");
    const add = (kind, list, extra) => out.push(Object.assign({ kind, ids: list.map(m => m.id), date: list[0].date, time: list[0].time, pitch: list[0].pitch }, extra));
    const groupBy = f => { const g = new Map(); ms.forEach(m => f(m).forEach(k => { if (!g.has(k)) g.set(k, []); g.get(k).push(m); })); return g; };
    ms.filter(m => !m.date || !m.time).forEach(m => add("nodate", [m]));
    const ok = ms.filter(m => m.date && m.time);
    groupBy(m => m.date && m.time ? [m.date + "|" + m.time + "|" + m.pitch] : []).forEach(l => { if (l.length > 1) add("pitch", l); });
    groupBy(m => m.date && m.time ? [m.home, m.away].filter(Boolean).map(t => t + "|" + m.date + "|" + m.time) : []).forEach((l, k) => { if (l.length > 1) add("teamTime", l, { team: k.split("|")[0] }); });
    if (T.sched.noBackToBack) groupBy(m => m.date ? [m.home, m.away].filter(Boolean).map(t => t + "|" + m.date) : []).forEach((l, k) => {
      if (l.length > 1 && !(new Set(l.map(m => m.time)).size < l.length)) add("teamDay", l, { team: k.split("|")[0] });
    });
    ok.forEach(m => { if (m.date < T.start || m.date > T.end) add("range", [m]); });
    const byId = Object.fromEntries(T.matches.map(m => [m.id, m]));
    ok.forEach(m => {
      if (!m.src) return;
      ["home", "away"].forEach(s => {
        const src = m.src[s], p = src && (src.type === "win" || src.type === "lose") && byId[src.match];
        if (p && !p.bye && p.date && byTime(p, m) >= 0) add("order", [m, p]);
      });
      if (["home", "away"].some(s => m.src[s] && m.src[s].type === "group")) {
        const g = T.matches.filter(x => isGroupStage(x) && x.date && ["home", "away"].some(s => m.src[s] && m.src[s].group === x.group));
        const last = g.sort(byTime).pop();
        if (last && byTime(last, m) >= 0) add("order", [m, last]);
      }
    });
    return out;
  }

  return { uid, shuffle, byCode, STAGES, GROUP_NAMES, draw, roundRobin, buildPhases, assignDates, resolve, winner, standings,
    groupDone, srcLabel, playerStats, parseISO, iso, addDays, isGroupStage, discipline, conflicts, byTime };
})();
