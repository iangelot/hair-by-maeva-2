const { body, env, json, requireAdmin } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const input = await body(req);
    const filename = String(input.filename || 'image.jpg').replace(/[^a-zA-Z0-9._-]/g, '-');
    const folder = String(input.folder || 'services').replace(/[^a-zA-Z0-9_-]/g, '');
    const contentType = String(input.contentType || 'image/jpeg');
    const base64Data = String(input.base64Data || '');

    if (!base64Data) return json(res, 400, { error: 'No image data provided.' });

    const buffer = Buffer.from(base64Data.replace(/^data:image\/[a-zA-Z+]+;base64,/, ''), 'base64');
    if (buffer.length > 15 * 1024 * 1024) {
      return json(res, 400, { error: 'File size exceeds 15MB limit.' });
    }

    const uploadPath = `${folder}/${Date.now()}-${filename}`;
    const storageUrl = `${env('SUPABASE_URL')}/storage/v1/object/hair-media/${uploadPath}`;

    const uploadRes = await fetch(storageUrl, {
      method: 'POST',
      headers: {
        apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
        Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: buffer
    });

    const result = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok) {
      console.error('Storage upload error:', result);
      return json(res, uploadRes.status || 500, { error: result.message || result.error || 'Failed to upload image to storage.' });
    }

    const publicUrl = `${env('SUPABASE_URL')}/storage/v1/object/public/hair-media/${uploadPath}`;
    return json(res, 200, { path: uploadPath, publicUrl });
  } catch (error) {
    console.error('Upload handler failure:', error);
    return json(res, error.statusCode || 500, { error: error.message || 'Image upload failed.' });
  }
};
