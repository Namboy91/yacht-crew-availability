(() => {
  const cfg = window.YCA_CONFIG;
  const { createClient } = window.supabase;
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });

  const app = document.getElementById("app");
  const navEl = document.getElementById("nav");
  let session = null;
  let me = null;
  let notice = null;

  const $ = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content;
  };
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const route = () => {
    const hash = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = hash.split("?");
    const params = new URLSearchParams(qs || "");
    return { path, params };
  };
  const go = (path) => {
    location.hash = path;
  };
  const setNotice = (msg, kind) => {
    notice = { msg, kind: kind || "" };
    render();
  };
  const redirectUrl = () => {
    const u = new URL(location.href);
    u.hash = "#/";
    u.search = "";
    return u.origin + u.pathname.replace(/index\.html$/, "").replace(/404\.html$/, "");
  };
  const months = (iso) => {
    if (!iso) return "";
    const d = new Date(iso + (iso.length === 7 ? "-01" : ""));
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  };
  const period = (a, b, current) => {
    const start = months(a) || a || "";
    const end = current ? "Present" : months(b) || b || "";
    return [start, end].filter(Boolean).join(" – ");
  };
  const overlap = (windows, start, end) => {
    if (!start && !end) return true;
    if (!windows || !windows.length) return true;
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;
    return windows.some((w) => {
      const ws = w.start ? new Date(w.start) : null;
      const we = w.end ? new Date(w.end) : null;
      if (s && we && we < s) return false;
      if (e && ws && ws > e) return false;
      return true;
    });
  };

  async function refreshMe() {
    me = null;
    if (!session?.user) return;
    const uid = session.user.id;
    const email = (session.user.email || "").toLowerCase();
    let { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) throw error;
    if (!data && email) {
      const claim = await sb
        .from("profiles")
        .update({ user_id: uid })
        .eq("email", email)
        .is("user_id", null)
        .select("*")
        .maybeSingle();
      if (claim.error) throw claim.error;
      data = claim.data;
    }
    me = data;
  }

  function nav() {
    const { path } = route();
    const items = [
      ["#/", "Home", path === "/"],
      ["#/crew", "Crew", path.startsWith("/crew") && path !== "/profile"],
      ["#/jobs", "Jobs", path.startsWith("/jobs")],
    ];
    if (session) {
      items.push(["#/profile", me?.role === "captain" ? "My jobs" : "My profile", path === "/profile" || path === "/edit"]);
    } else {
      items.push(["#/signin", "Sign in", path === "/signin"]);
    }
    navEl.innerHTML = items
      .map(
        ([href, label, active]) =>
          `<a href="${href}" class="${active ? "active" : ""}">${label}</a>`
      )
      .join("");
    if (session) {
      const b = document.createElement("button");
      b.className = "linkish";
      b.textContent = "Sign out";
      b.onclick = async () => {
        await sb.auth.signOut();
        me = null;
        go("/");
      };
      navEl.appendChild(b);
    }
  }

  function banner() {
    if (!notice) return "";
    return `<div class="notice ${esc(notice.kind)}">${esc(notice.msg)}</div>`;
  }

  function home() {
    return `
      ${banner()}
      <section class="hero">
        <div class="copy">
          <h1>Yacht crew, ready when you are</h1>
          <p>Captains search experienced crew by role and dates. Crew keep a live profile, availability windows, and CV in one place.</p>
          <p class="muted">Sign in with your email. No passwords. Contact is by email only.</p>
          <div class="row" style="margin-top:18px">
            ${session ? `<a class="btn" href="#/crew">Browse crew</a><a class="btn secondary" href="#/profile">Open my account</a>` : `<a class="btn" href="#/signin">Sign in with email</a><a class="btn secondary" href="#/crew">See how it works</a>`}
          </div>
        </div>
        <img class="photo" src="${esc(cfg.photoUrl)}" alt="Crew at work">
      </section>
      <div class="grid-2">
        <div class="card">
          <h2>For crew</h2>
          <p>Record certificates, yacht experience, two-week relief and shipyard windows, and upload a CV. Captains see your public profile once they sign in.</p>
        </div>
        <div class="card">
          <h2>For captains</h2>
          <p>Search by role and dates, open a crew profile, and post a job when you need cover.</p>
        </div>
      </div>`;
  }

  function signInView() {
    return `
      ${banner()}
      <div class="card" style="max-width:480px">
        <h1>Sign in</h1>
        <p class="muted">We will email you a one-time magic link. Use the same email as your profile so the two can be linked.</p>
        <form id="signin-form">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" required autocomplete="email" placeholder="you@example.com">
          <div class="row" style="margin-top:16px">
            <button type="submit">Send magic link</button>
          </div>
        </form>
      </div>`;
  }

  function chooseRoleView() {
    const email = session?.user?.email || "";
    return `
      ${banner()}
      <div class="card" style="max-width:560px">
        <h1>Choose your role</h1>
        <p class="muted">Signed in as ${esc(email)}. This is a new account, so tell us whether you are crew or a captain.</p>
        <form id="role-form">
          <label>I am a</label>
          <select name="role" required>
            <option value="crew">Crew member</option>
            <option value="captain">Captain</option>
          </select>
          <label>Full name</label>
          <input name="full_name" required>
          <label>Position</label>
          <input name="position" placeholder="Chief Engineer, Captain, …">
          <div class="row" style="margin-top:16px"><button type="submit">Create profile</button></div>
        </form>
      </div>`;
  }

  function certRows(list) {
    if (!list?.length) return "<p class='muted'>No certificates listed yet.</p>";
    return `<table><thead><tr><th>Certificate</th><th>Issued</th><th>Expires</th><th>Notes</th></tr></thead><tbody>${list
      .map(
        (c) =>
          `<tr><td>${esc(c.name)}</td><td>${esc(c.issued || "—")}</td><td>${esc(c.expires || "—")}</td><td>${esc(c.notes || "")}</td></tr>`
      )
      .join("")}</tbody></table>`;
  }

  function yachtRows(list) {
    if (!list?.length) return "<p class='muted'>No yacht experience listed yet.</p>";
    return list
      .map((y) => {
        const size = y.size_m ? `${y.size_m} m` : "";
        return `<article class="job">
          <div class="job-head"><span>${esc(y.vessel || "")}</span><span>${esc(size)}</span><span>${esc(y.position || "")}</span><span>${esc(period(y.start, y.end, y.current))}</span></div>
          ${y.description ? `<p>${esc(y.description)}</p>` : ""}
        </article>`;
      })
      .join("");
  }

  function windowRows(list) {
    if (!list?.length) return "<p class='muted'>No availability windows listed yet. Dates on request.</p>";
    return `<ul>${list
      .map(
        (w) =>
          `<li>${esc(w.start || "")} – ${esc(w.end || "open")} ${w.kind ? "· " + esc(w.kind) : ""} ${w.notes ? "· " + esc(w.notes) : ""}</li>`
      )
      .join("")}</ul>`;
  }

  function profileView(p, isMine) {
    const photo = p.email === "podevillet@hotmail.com" ? cfg.photoUrl : "";
    const chips = [...(p.roles_list || []), ...(p.areas || [])].map((x) => `<span class="chip">${esc(x)}</span>`).join("");
    return `
      ${banner()}
      <div class="card">
        <div class="crew-card">
          ${photo ? `<img src="${esc(photo)}" alt="${esc(p.full_name)}">` : "<div></div>"}
          <div>
            <h1>${esc(p.full_name)}</h1>
            <p class="meta"><strong>${esc(p.position || p.role)}</strong>${p.headline ? " · " + esc(p.headline) : ""}</p>
            <p class="muted">${esc(p.nationality || "")}${p.languages?.length ? " · " + esc(p.languages.join(", ")) : ""}</p>
            <div class="chips">${chips}</div>
            ${p.email ? `<p style="margin-top:12px">Email: <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></p>` : ""}
            ${isMine ? `<div class="row"><a class="btn" href="#/edit">Edit profile and availability</a></div>` : ""}
            ${p.cv_path ? `<p><button type="button" id="cv-btn" class="secondary">Download CV (PDF)</button></p>` : ""}
          </div>
        </div>
        ${p.summary ? `<p>${esc(p.summary)}</p>` : ""}
        ${p.visas?.length ? `<p class="meta"><strong>Visas:</strong> ${esc(p.visas.join(" · "))}</p>` : ""}
      </div>
      <div class="bar">Availability</div>
      <div class="card">${windowRows(p.availability_windows)}</div>
      <div class="bar">Certificates</div>
      <div class="card">${certRows(p.certificates)}</div>
      <div class="bar">Yachts and experience</div>
      <div class="card">${yachtRows(p.yachts_experience)}</div>
      ${
        p.referees?.length
          ? `<div class="bar">References</div><div class="card">${p.referees
              .map(
                (r) =>
                  `<div class="ref"><strong>${esc(r.name)}</strong>${r.title ? " · " + esc(r.title) : ""}${r.vessel ? " · " + esc(r.vessel) : ""} ${r.email ? `· <a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : ""}</div>`
              )
              .join("")}</div>`
          : ""
      }
      ${
        p.quotes?.length
          ? `<div class="bar">What captains say</div><div class="card">${p.quotes
              .map((q) => `<blockquote class="quote">“${esc(q.text)}” <cite>— ${esc(q.attribution || "")}</cite></blockquote>`)
              .join("")}</div>`
          : ""
      }`;
  }

  function jsonArea(name, value) {
    return `<label>${esc(name)} (JSON)</label><textarea name="${esc(name)}" spellcheck="false">${esc(JSON.stringify(value || [], null, 2))}</textarea>`;
  }

  function editView(p) {
    const windows = p.availability_windows || [];
    return `
      ${banner()}
      <div class="card">
        <h1>Edit profile</h1>
        <form id="edit-form">
          <div class="grid-2">
            <div>
              <label>Full name</label>
              <input name="full_name" value="${esc(p.full_name)}" required>
            </div>
            <div>
              <label>Position</label>
              <input name="position" value="${esc(p.position || "")}">
            </div>
          </div>
          <label>Headline</label>
          <input name="headline" value="${esc(p.headline || "")}">
          <label>Summary</label>
          <textarea name="summary">${esc(p.summary || "")}</textarea>
          <label>Nationality</label>
          <input name="nationality" value="${esc(p.nationality || "")}">
          <label>Languages (comma separated)</label>
          <input name="languages" value="${esc((p.languages || []).join(", "))}">
          <label>Visas (comma separated)</label>
          <input name="visas" value="${esc((p.visas || []).join(", "))}">
          <label>Areas (comma separated)</label>
          <input name="areas" value="${esc((p.areas || []).join(", "))}">
          <label>Roles (comma separated)</label>
          <input name="roles_list" value="${esc((p.roles_list || []).join(", "))}">
          <div class="bar">Availability windows</div>
          <p class="muted">Add two-week relief, shipyard, or rotation periods. Leave empty if dates are on request.</p>
          <div id="windows">${windows
            .map(
              (w, i) =>
                `<div class="grid-2 window-row" data-i="${i}">
                  <div><label>Start</label><input type="date" name="w_start_${i}" value="${esc(w.start || "")}"></div>
                  <div><label>End</label><input type="date" name="w_end_${i}" value="${esc(w.end || "")}"></div>
                  <div><label>Kind</label><input name="w_kind_${i}" value="${esc(w.kind || "")}" placeholder="2-week relief, shipyard, …"></div>
                  <div><label>Notes</label><input name="w_notes_${i}" value="${esc(w.notes || "")}"></div>
                </div>`
            )
            .join("")}</div>
          <div class="row" style="margin:10px 0 18px"><button type="button" class="secondary" id="add-window">Add a window</button></div>
          ${jsonArea("certificates", p.certificates)}
          ${jsonArea("yachts_experience", p.yachts_experience)}
          ${jsonArea("referees", p.referees)}
          ${jsonArea("quotes", p.quotes)}
          <div class="bar">CV</div>
          <p class="muted">${p.cv_path ? "Current file: " + esc(p.cv_path) : "No CV uploaded yet."} PDF only, up to 10 MB, stored in your own folder.</p>
          <input type="file" id="cv-file" accept="application/pdf">
          <div class="row" style="margin-top:16px">
            <button type="submit">Save profile</button>
            <a class="btn secondary" href="#/profile">Cancel</a>
          </div>
        </form>
      </div>`;
  }

  function crewListView(rows, filters) {
    const cards = rows.length
      ? rows
          .map((p) => {
            const photo = p.email === "podevillet@hotmail.com" ? cfg.photoUrl : "";
            const avail = p.availability_windows?.length
              ? p.availability_windows.map((w) => `${w.start || ""}–${w.end || "open"}`).join("; ")
              : "Dates on request";
            return `<div class="card crew-card">
              ${photo ? `<img src="${esc(photo)}" alt="">` : "<div></div>"}
              <div>
                <h2 style="text-transform:none;letter-spacing:0">${esc(p.full_name)}</h2>
                <p class="meta"><strong>${esc(p.position || "")}</strong>${p.headline ? " · " + esc(p.headline) : ""}</p>
                <p class="muted">${esc(avail)}</p>
                <a class="btn" href="#/crew/${esc(p.id)}">View profile</a>
              </div>
            </div>`;
          })
          .join("")
      : `<div class="card"><p>No crew match those filters yet.</p></div>`;
    return `
      ${banner()}
      <h1>Crew</h1>
      ${session ? "" : `<div class="notice">Sign in to browse crew profiles.</div>`}
      <form id="search-form" class="card">
        <div class="grid-2">
          <div>
            <label>Role</label>
            <input name="role" value="${esc(filters.role || "")}" placeholder="Chief Engineer, Second Engineer, …">
          </div>
          <div>
            <label>Start date</label>
            <input type="date" name="start" value="${esc(filters.start || "")}">
          </div>
          <div>
            <label>End date</label>
            <input type="date" name="end" value="${esc(filters.end || "")}">
          </div>
        </div>
        <div class="row" style="margin-top:12px"><button type="submit">Search</button></div>
      </form>
      ${session ? cards : ""}`;
  }

  function jobsView(jobs, canPost) {
    const list = jobs.length
      ? jobs
          .map(
            (j) => `<article class="job">
              <div class="job-head"><span>${esc(j.title)}</span><span>${esc(j.yacht_name || "")}${j.yacht_size_m ? " · " + esc(j.yacht_size_m) + " m" : ""}</span><span>${esc(j.role_needed || "")}</span><span>${esc(period(j.start_date, j.end_date))}</span></div>
              <p class="muted">${esc(j.location || "")}</p>
              ${j.description ? `<p>${esc(j.description)}</p>` : ""}
            </article>`
          )
          .join("")
      : "<p class='muted'>No job posts yet.</p>";
    return `
      ${banner()}
      <h1>Job posts</h1>
      <div class="card">${list}</div>
      ${
        canPost
          ? `<div class="card"><h2>Post a job</h2>
            <form id="job-form">
              <label>Title</label><input name="title" required>
              <div class="grid-2">
                <div><label>Yacht name</label><input name="yacht_name"></div>
                <div><label>Size (metres)</label><input name="yacht_size_m" type="number" step="0.1"></div>
                <div><label>Role needed</label><input name="role_needed" required placeholder="Chief Engineer"></div>
                <div><label>Location</label><input name="location"></div>
                <div><label>Start</label><input type="date" name="start_date"></div>
                <div><label>End</label><input type="date" name="end_date"></div>
              </div>
              <label>Description</label><textarea name="description"></textarea>
              <div class="row" style="margin-top:16px"><button type="submit">Publish job</button></div>
            </form></div>`
          : session
            ? `<p class="muted">Only captains can post jobs. Crew can still browse openings.</p>`
            : `<div class="notice">Sign in as a captain to post a job.</div>`
      }`;
  }

  async function render() {
    nav();
    const { path, params } = route();
    try {
      if (path === "/signin") {
        if (session) {
          go(me ? "/profile" : "/choose-role");
          return;
        }
        app.replaceChildren($(`${signInView()}`));
        app.querySelector("#signin-form").onsubmit = async (e) => {
          e.preventDefault();
          const email = e.target.email.value.trim();
          const { error } = await sb.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true },
          });
          if (error) setNotice(error.message, "error");
          else setNotice("Check your inbox for a magic link. It will bring you back to this site.", "ok");
        };
        return;
      }

      if (!session && (path === "/profile" || path === "/edit" || path === "/choose-role")) {
        go("/signin");
        return;
      }

      if (path === "/choose-role") {
        if (me) {
          go("/profile");
          return;
        }
        app.replaceChildren($(`${chooseRoleView()}`));
        app.querySelector("#role-form").onsubmit = async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const row = {
            user_id: session.user.id,
            email: session.user.email,
            role: fd.get("role"),
            full_name: fd.get("full_name"),
            position: fd.get("position") || null,
          };
          const { error } = await sb.from("profiles").insert(row);
          if (error) setNotice(error.message, "error");
          else {
            await refreshMe();
            notice = { msg: "Profile created.", kind: "ok" };
            go("/profile");
          }
        };
        return;
      }

      if (path === "/profile" || path === "/edit") {
        if (!me) {
          go("/choose-role");
          return;
        }
        if (path === "/edit") {
          if (me.role !== "crew" && me.role !== "captain") {
            go("/profile");
            return;
          }
          if (me.role === "captain") {
            go("/jobs");
            return;
          }
          app.replaceChildren($(`${editView(me)}`));
          bindEdit(me);
          return;
        }
        if (me.role === "captain") {
          go("/jobs");
          return;
        }
        app.replaceChildren($(`${profileView(me, true)}`));
        bindCv(me);
        return;
      }

      if (path.startsWith("/crew/") && path !== "/crew") {
        if (!session) {
          go("/signin");
          return;
        }
        const id = path.slice("/crew/".length);
        const { data, error } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!data) {
          app.replaceChildren($(`${banner()}<div class="card"><p>Profile not found.</p></div>`));
          return;
        }
        const isMine = me && me.id === data.id;
        app.replaceChildren($(`${profileView(data, isMine)}`));
        bindCv(data);
        return;
      }

      if (path === "/crew") {
        const filters = {
          role: params.get("role") || "",
          start: params.get("start") || "",
          end: params.get("end") || "",
        };
        let rows = [];
        if (session) {
          const { data, error } = await sb
            .from("profiles")
            .select("*")
            .eq("role", "crew")
            .order("full_name");
          if (error) throw error;
          rows = (data || []).filter((p) => {
            const roleQ = filters.role.trim().toLowerCase();
            const roleOk =
              !roleQ ||
              (p.position || "").toLowerCase().includes(roleQ) ||
              (p.roles_list || []).some((r) => String(r).toLowerCase().includes(roleQ));
            return roleOk && overlap(p.availability_windows, filters.start, filters.end);
          });
        }
        app.replaceChildren($(`${crewListView(rows, filters)}`));
        const form = app.querySelector("#search-form");
        if (form) {
          form.onsubmit = (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const q = new URLSearchParams();
            for (const k of ["role", "start", "end"]) if (fd.get(k)) q.set(k, fd.get(k));
            go("/crew" + (q.toString() ? "?" + q.toString() : ""));
          };
        }
        return;
      }

      if (path === "/jobs") {
        let jobs = [];
        if (session) {
          const { data, error } = await sb
            .from("job_posts")
            .select("*")
            .order("created_at", { ascending: false });
          if (error) throw error;
          jobs = data || [];
        }
        app.replaceChildren($(`${jobsView(jobs, me?.role === "captain")}`));
        const form = app.querySelector("#job-form");
        if (form) {
          form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const row = {
              captain_id: me.id,
              title: fd.get("title"),
              yacht_name: fd.get("yacht_name") || null,
              yacht_size_m: fd.get("yacht_size_m") ? Number(fd.get("yacht_size_m")) : null,
              role_needed: fd.get("role_needed"),
              location: fd.get("location") || null,
              start_date: fd.get("start_date") || null,
              end_date: fd.get("end_date") || null,
              description: fd.get("description") || null,
            };
            const { error } = await sb.from("job_posts").insert(row);
            if (error) setNotice(error.message, "error");
            else {
              notice = { msg: "Job posted.", kind: "ok" };
              render();
            }
          };
        }
        return;
      }

      app.replaceChildren($(`${home()}`));
    } catch (err) {
      app.replaceChildren($(`<div class="notice error">${esc(err.message || err)}</div>`));
    }
  }

  function bindCv(p) {
    const btn = document.getElementById("cv-btn");
    if (!btn || !p.cv_path) return;
    btn.onclick = async () => {
      const { data, error } = await sb.storage.from("cvs").createSignedUrl(p.cv_path, 60);
      if (error) setNotice(error.message, "error");
      else window.open(data.signedUrl, "_blank", "noopener");
    };
  }

  function parseJsonField(form, name) {
    const raw = form.elements[name].value.trim() || "[]";
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`${name} is not valid JSON`);
    }
  }

  function bindEdit(p) {
    let extra = (p.availability_windows || []).length;
    document.getElementById("add-window").onclick = () => {
      const i = extra++;
      const wrap = document.getElementById("windows");
      const div = document.createElement("div");
      div.className = "grid-2 window-row";
      div.innerHTML = `<div><label>Start</label><input type="date" name="w_start_${i}"></div>
        <div><label>End</label><input type="date" name="w_end_${i}"></div>
        <div><label>Kind</label><input name="w_kind_${i}" placeholder="2-week relief, shipyard, …"></div>
        <div><label>Notes</label><input name="w_notes_${i}"></div>`;
      wrap.appendChild(div);
    };
    document.getElementById("edit-form").onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      try {
        const windows = [...form.querySelectorAll(".window-row")]
          .map((row) => {
            const inputs = row.querySelectorAll("input");
            return {
              start: inputs[0].value || null,
              end: inputs[1].value || null,
              kind: inputs[2].value || null,
              notes: inputs[3].value || null,
            };
          })
          .filter((w) => w.start || w.end || w.kind || w.notes);
        const split = (v) =>
          (v || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        const patch = {
          full_name: form.full_name.value,
          position: form.position.value || null,
          headline: form.headline.value || null,
          summary: form.summary.value || null,
          nationality: form.nationality.value || null,
          languages: split(form.languages.value),
          visas: split(form.visas.value),
          areas: split(form.areas.value),
          roles_list: split(form.roles_list.value),
          availability_windows: windows,
          certificates: parseJsonField(form, "certificates"),
          yachts_experience: parseJsonField(form, "yachts_experience"),
          referees: parseJsonField(form, "referees"),
          quotes: parseJsonField(form, "quotes"),
        };
        const file = document.getElementById("cv-file").files[0];
        if (file) {
          if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
            throw new Error("Please upload a PDF.");
          }
          const path = `${session.user.id}/${file.name.replace(/[^\w.\-]+/g, "-")}`;
          const up = await sb.storage.from("cvs").upload(path, file, { upsert: true, contentType: "application/pdf" });
          if (up.error) throw up.error;
          patch.cv_path = path;
        }
        const { error } = await sb.from("profiles").update(patch).eq("id", p.id);
        if (error) throw error;
        await refreshMe();
        notice = { msg: "Profile saved.", kind: "ok" };
        go("/profile");
      } catch (err) {
        setNotice(err.message || String(err), "error");
      }
    };
  }

  async function boot() {
    const { data } = await sb.auth.getSession();
    session = data.session;
    if (session) {
      try {
        await refreshMe();
      } catch (err) {
        notice = { msg: err.message, kind: "error" };
      }
    }
    const url = new URL(location.href);
    if (url.searchParams.get("code") || url.hash.includes("access_token")) {
      url.search = "";
      history.replaceState({}, "", url.pathname + url.search + "#/");
    }
    await render();
  }

  sb.auth.onAuthStateChange(async (_event, next) => {
    session = next;
    if (session) {
      try {
        await refreshMe();
      } catch (err) {
        notice = { msg: err.message, kind: "error" };
      }
    } else me = null;
    render();
  });

  window.addEventListener("hashchange", () => {
    notice = null;
    render();
  });
  boot();
})();
