/**
 * Aircraft 4 Sale — Cloudflare Worker API
 * ========================================
 * Roger Wilco Aviation Services
 *
 * Handles:
 *   1. Listings CRUD         (GET/POST/PUT/DELETE /listings)
 *   2. R2 file uploads       (POST /upload, GET /files/*)
 *   3. Email verification    (POST /verify-email)
 *   4. Admin approval        (POST /admin/approve, /admin/reject)
 *   5. Public browse         (GET /browse)
 *
 * Bindings required:
 *   KV:  SALEDATA    — listing metadata
 *   R2:  SALEBUCKET  — photos & logbook documents
 *
 * Environment variables:
 *   ADMIN_TOKEN     — admin auth for approvals
 *   RESEND_API_KEY  — (optional) email verification via Resend
 *   FROM_EMAIL      — verified sender email
 *
 * Deploy: npx wrangler deploy -c aircraft-sale-wrangler.toml
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
  'Access-Control-Max-Age': '86400',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function adminAuth(request, env) {
  const tok = (request.headers.get('X-Admin-Token') || '').trim();
  return tok && tok === (env.ADMIN_TOKEN || '');
}

/* ── Listing ID generator ── */
function makeId() {
  const ts = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 7);
  return `${ts}-${r}`;
}

/* ── KV helpers ── */
async function getAllListings(env) {
  const raw = await env.SALEDATA.get('listings');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function saveAllListings(env, listings) {
  await env.SALEDATA.put('listings', JSON.stringify(listings));
}

async function getVerifyCodes(env) {
  const raw = await env.SALEDATA.get('verify-codes');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

async function saveVerifyCodes(env, codes) {
  await env.SALEDATA.put('verify-codes', JSON.stringify(codes));
}

/* ── Email verification ── */
async function handleSendCode(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { email, name } = body;
  if (!email) return json({ error: 'Email required' }, 400);

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codes = await getVerifyCodes(env);
  codes[email.toLowerCase()] = { code, name: name || '', created: Date.now() };
  await saveVerifyCodes(env, codes);

  // Try sending via Resend
  const resendKey = env.RESEND_API_KEY || '';
  if (resendKey) {
    const fromEmail = env.FROM_EMAIL || 'RWAS <noreply@rogerwilcoaviation.com>';
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: `${code} — Your Aircraft Listing Verification Code`,
          html: `
            <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#f7f4ef;border:1px solid #1a1a1a">
              <h2 style="font-family:Georgia,serif;color:#0a0a0a;margin-bottom:8px;font-size:22px">Roger Wilco Aviation Services</h2>
              <p style="color:#444;font-size:14px;line-height:1.6">
                Hi ${name || 'there'},<br><br>
                Your verification code for the Aircraft 4 Sale listing portal is:
              </p>
              <div style="background:#ede9e2;border:1px solid #1a1a1a;padding:20px;text-align:center;margin:20px 0">
                <span style="font-size:32px;font-weight:700;letter-spacing:6px;color:#0a0a0a;font-family:monospace">${code}</span>
              </div>
              <p style="color:#666;font-size:13px">This code expires in 15 minutes.</p>
              <hr style="border:none;border-top:1px solid #1a1a1a;margin:20px 0">
              <p style="color:#999;font-size:11px;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.08em">
                Roger Wilco Aviation Services · KYKN · Yankton, SD
              </p>
            </div>
          `,
        }),
      });
      if (res.ok) return json({ ok: true, sent: true });
    } catch (e) {
      console.error('Resend error:', e);
    }
  }

  // Fallback: code stored, admin can relay
  return json({ ok: true, sent: false, note: 'Code stored. Contact RWAS to complete verification.' });
}

async function handleCheckCode(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { email, code } = body;
  if (!email || !code) return json({ error: 'Email and code required' }, 400);

  const codes = await getVerifyCodes(env);
  const entry = codes[email.toLowerCase()];
  if (!entry) return json({ error: 'No code found for this email. Request a new one.' }, 400);

  // 15 minute expiry
  if (Date.now() - entry.created > 15 * 60 * 1000) {
    delete codes[email.toLowerCase()];
    await saveVerifyCodes(env, codes);
    return json({ error: 'Code expired. Request a new one.' }, 400);
  }

  if (entry.code !== code) return json({ error: 'Incorrect code.' }, 400);

  // Valid — generate a session token
  const sessionToken = makeId() + '-' + makeId();
  codes[email.toLowerCase()].session = sessionToken;
  codes[email.toLowerCase()].verified = Date.now();
  await saveVerifyCodes(env, codes);

  return json({ ok: true, verified: true, session: sessionToken, name: entry.name });
}

/* ── Session check ── */
async function checkSession(request, env) {
  const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!auth) return null;

  const codes = await getVerifyCodes(env);
  for (const [email, entry] of Object.entries(codes)) {
    if (entry.session === auth && entry.verified) {
      // Sessions valid for 24 hours
      if (Date.now() - entry.verified < 24 * 60 * 60 * 1000) {
        return { email, name: entry.name };
      }
    }
  }
  return null;
}

/* ── Listings CRUD ── */
async function handleCreateListing(request, env) {
  const user = await checkSession(request, env);
  if (!user) return json({ error: 'Authentication required' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const required = ['make', 'model', 'year', 'price'];
  for (const f of required) {
    if (!body[f]) return json({ error: `Missing required field: ${f}` }, 400);
  }

  const listing = {
    id: makeId(),
    status: 'pending', // pending | approved | rejected
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sellerEmail: user.email,
    sellerName: user.name || body.sellerName || '',
    sellerPhone: body.sellerPhone || '',
    sellerLocation: body.sellerLocation || '',
    // Aircraft details
    make: body.make,
    model: body.model,
    year: parseInt(body.year),
    serialNumber: body.serialNumber || '',
    nNumber: body.nNumber || '',
    totalTime: body.totalTime || '',
    engineTime: body.engineTime || '',
    engineModel: body.engineModel || '',
    propTime: body.propTime || '',
    propModel: body.propModel || '',
    price: body.price,
    priceLabel: body.priceLabel || '', // "Call for price", "Make offer", etc.
    description: body.description || '',
    avionics: body.avionics || '',
    equipmentList: body.equipmentList || '',
    annualDue: body.annualDue || '',
    usefulLoad: body.usefulLoad || '',
    fuelCapacity: body.fuelCapacity || '',
    cruiseSpeed: body.cruiseSpeed || '',
    range: body.range || '',
    category: body.category || 'single-piston', // single-piston, multi-piston, turboprop, jet, helicopter, experimental, other
    condition: body.condition || 'used', // new, used
    damageHistory: body.damageHistory || 'none',
    // File manifests (populated by upload endpoints)
    photos: [],
    logbooks: {
      airframe: [],
      powerplant: [],
      propeller: [],
      adSbCompliance: [],
      misc: [],
    },
  };

  const listings = await getAllListings(env);
  listings.push(listing);
  await saveAllListings(env, listings);

  return json({ ok: true, listing });
}

async function handleUpdateListing(request, env, listingId) {
  const user = await checkSession(request, env);
  const isAdmin = adminAuth(request, env);
  if (!user && !isAdmin) return json({ error: 'Authentication required' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const listings = await getAllListings(env);
  const idx = listings.findIndex(l => l.id === listingId);
  if (idx === -1) return json({ error: 'Listing not found' }, 404);

  // Only owner or admin can update
  if (!isAdmin && listings[idx].sellerEmail !== user.email) {
    return json({ error: 'Not authorized to edit this listing' }, 403);
  }

  // Don't allow changing id, sellerEmail, status (use admin endpoints for status)
  const protected_fields = ['id', 'sellerEmail', 'createdAt', 'status'];
  for (const f of protected_fields) delete body[f];

  listings[idx] = { ...listings[idx], ...body, updatedAt: new Date().toISOString() };
  await saveAllListings(env, listings);

  return json({ ok: true, listing: listings[idx] });
}

async function handleDeleteListing(request, env, listingId) {
  const user = await checkSession(request, env);
  const isAdmin = adminAuth(request, env);
  if (!user && !isAdmin) return json({ error: 'Authentication required' }, 401);

  const listings = await getAllListings(env);
  const idx = listings.findIndex(l => l.id === listingId);
  if (idx === -1) return json({ error: 'Listing not found' }, 404);

  if (!isAdmin && listings[idx].sellerEmail !== user.email) {
    return json({ error: 'Not authorized' }, 403);
  }

  // Delete R2 files for this listing
  try {
    const r2list = await env.SALEBUCKET.list({ prefix: `listings/${listingId}/` });
    for (const obj of r2list.objects) {
      await env.SALEBUCKET.delete(obj.key);
    }
  } catch (e) { console.error('R2 cleanup error:', e); }

  listings.splice(idx, 1);
  await saveAllListings(env, listings);

  return json({ ok: true });
}

/* ── File upload to R2 ── */
async function handleUpload(request, env) {
  const user = await checkSession(request, env);
  const isAdmin = adminAuth(request, env);
  if (!user && !isAdmin) return json({ error: 'Authentication required' }, 401);

  const url = new URL(request.url);
  const listingId = url.searchParams.get('listingId');
  const category = url.searchParams.get('category'); // photos, airframe, powerplant, propeller, adSbCompliance, misc
  const filename = url.searchParams.get('filename');

  if (!listingId || !category || !filename) {
    return json({ error: 'Missing params: listingId, category, filename' }, 400);
  }

  // Verify listing exists and user owns it
  const listings = await getAllListings(env);
  const listing = listings.find(l => l.id === listingId);
  if (!listing) return json({ error: 'Listing not found' }, 404);
  if (!isAdmin && listing.sellerEmail !== (user && user.email)) {
    return json({ error: 'Not authorized' }, 403);
  }

  // Read file body
  const fileData = await request.arrayBuffer();
  if (fileData.byteLength > 50 * 1024 * 1024) {
    return json({ error: 'File too large. Maximum 50MB.' }, 413);
  }

  // Sanitize filename
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `listings/${listingId}/${category}/${safeName}`;

  // Detect content type
  const ext = safeName.split('.').pop().toLowerCase();
  const contentTypes = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    tif: 'image/tiff', tiff: 'image/tiff', bmp: 'image/bmp',
  };
  const contentType = contentTypes[ext] || 'application/octet-stream';

  await env.SALEBUCKET.put(key, fileData, {
    httpMetadata: { contentType },
    customMetadata: {
      uploadedBy: user ? user.email : 'admin',
      uploadedAt: new Date().toISOString(),
      originalName: filename,
    },
  });

  // Update listing metadata
  const idx = listings.findIndex(l => l.id === listingId);
  const fileRecord = {
    key,
    name: filename,
    size: fileData.byteLength,
    type: contentType,
    uploadedAt: new Date().toISOString(),
  };

  if (category === 'photos') {
    listings[idx].photos.push(fileRecord);
  } else if (listings[idx].logbooks[category]) {
    listings[idx].logbooks[category].push(fileRecord);
  }

  listings[idx].updatedAt = new Date().toISOString();
  await saveAllListings(env, listings);

  return json({ ok: true, file: fileRecord });
}

/* ── Serve files from R2 ── */
async function handleGetFile(request, env, key) {
  const obj = await env.SALEBUCKET.get(key);
  if (!obj) return new Response('Not found', { status: 404, headers: CORS });

  const headers = new Headers(CORS);
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=86400');
  if (obj.customMetadata?.originalName) {
    headers.set('Content-Disposition', `inline; filename="${obj.customMetadata.originalName}"`);
  }

  return new Response(obj.body, { headers });
}

/* ── Delete a single file from R2 ── */
async function handleDeleteFile(request, env) {
  const user = await checkSession(request, env);
  const isAdmin = adminAuth(request, env);
  if (!user && !isAdmin) return json({ error: 'Authentication required' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { listingId, category, fileKey } = body;
  if (!listingId || !fileKey) return json({ error: 'Missing listingId or fileKey' }, 400);

  const listings = await getAllListings(env);
  const idx = listings.findIndex(l => l.id === listingId);
  if (idx === -1) return json({ error: 'Listing not found' }, 404);
  if (!isAdmin && listings[idx].sellerEmail !== (user && user.email)) {
    return json({ error: 'Not authorized' }, 403);
  }

  // Delete from R2
  await env.SALEBUCKET.delete(fileKey);

  // Remove from listing metadata
  if (category === 'photos') {
    listings[idx].photos = listings[idx].photos.filter(f => f.key !== fileKey);
  } else if (listings[idx].logbooks[category]) {
    listings[idx].logbooks[category] = listings[idx].logbooks[category].filter(f => f.key !== fileKey);
  }
  listings[idx].updatedAt = new Date().toISOString();
  await saveAllListings(env, listings);

  return json({ ok: true });
}

/* ── Admin: approve / reject ── */
async function handleAdminAction(request, env, action) {
  if (!adminAuth(request, env)) return json({ error: 'Admin auth required' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { listingId } = body;
  if (!listingId) return json({ error: 'listingId required' }, 400);

  const listings = await getAllListings(env);
  const idx = listings.findIndex(l => l.id === listingId);
  if (idx === -1) return json({ error: 'Listing not found' }, 404);

  listings[idx].status = action; // 'approved' or 'rejected'
  listings[idx].updatedAt = new Date().toISOString();
  listings[idx][`${action}At`] = new Date().toISOString();
  await saveAllListings(env, listings);

  return json({ ok: true, listing: listings[idx] });
}

/* ── Public browse (only approved listings) ── */
async function handleBrowse(request, env) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const make = url.searchParams.get('make');
  const search = url.searchParams.get('q');

  let listings = await getAllListings(env);

  // Public sees only approved
  listings = listings.filter(l => l.status === 'approved');

  if (category) listings = listings.filter(l => l.category === category);
  if (make) listings = listings.filter(l => l.make.toLowerCase().includes(make.toLowerCase()));
  if (search) {
    const q = search.toLowerCase();
    listings = listings.filter(l =>
      (l.make + ' ' + l.model + ' ' + l.description + ' ' + l.nNumber + ' ' + l.avionics)
        .toLowerCase().includes(q)
    );
  }

  // Sort newest first
  listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return json({ listings });
}

/* ── Admin: get all listings (any status) ── */
async function handleAdminList(request, env) {
  if (!adminAuth(request, env)) return json({ error: 'Admin auth required' }, 401);
  const listings = await getAllListings(env);
  listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return json({ listings });
}

/* ── Request Router ── */
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // Health
    if (path === '/' || path === '/health') {
      return json({
        service: 'RWAS Aircraft 4 Sale API',
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    }

    // Public browse
    if (path === '/browse' && request.method === 'GET') {
      return handleBrowse(request, env);
    }

    // Get single listing (public if approved)
    if (path.startsWith('/listing/') && request.method === 'GET') {
      const listingId = path.replace('/listing/', '');
      const listings = await getAllListings(env);
      const listing = listings.find(l => l.id === listingId);
      if (!listing) return json({ error: 'Not found' }, 404);
      if (listing.status !== 'approved') {
        // Allow owner or admin to see non-approved
        const user = await checkSession(request, env);
        const isAdmin = adminAuth(request, env);
        if (!isAdmin && (!user || user.email !== listing.sellerEmail)) {
          return json({ error: 'Not found' }, 404);
        }
      }
      return json({ listing });
    }

    // Email verification
    if (path === '/send-code' && request.method === 'POST') return handleSendCode(request, env);
    if (path === '/check-code' && request.method === 'POST') return handleCheckCode(request, env);

    // Create listing
    if (path === '/listings' && request.method === 'POST') return handleCreateListing(request, env);

    // Update listing
    if (path.startsWith('/listings/') && request.method === 'PUT') {
      const id = path.replace('/listings/', '');
      return handleUpdateListing(request, env, id);
    }

    // Delete listing
    if (path.startsWith('/listings/') && request.method === 'DELETE') {
      const id = path.replace('/listings/', '');
      return handleDeleteListing(request, env, id);
    }

    // File upload
    if (path === '/upload' && request.method === 'POST') return handleUpload(request, env);

    // File delete
    if (path === '/delete-file' && request.method === 'POST') return handleDeleteFile(request, env);

    // Serve files from R2
    if (path.startsWith('/files/')) {
      const key = decodeURIComponent(path.replace('/files/', ''));
      return handleGetFile(request, env, key);
    }

    // Admin endpoints
    if (path === '/admin/listings' && request.method === 'GET') return handleAdminList(request, env);
    if (path === '/admin/approve' && request.method === 'POST') return handleAdminAction(request, env, 'approved');
    if (path === '/admin/reject' && request.method === 'POST') return handleAdminAction(request, env, 'rejected');

    return json({ error: 'Not found' }, 404);
  },
};
