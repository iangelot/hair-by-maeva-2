const { json, supabase } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const [policies, socials, sections] = await Promise.all([
      supabase('policies?is_visible=eq.true&select=policy_key,title,body,display_order&order=display_order.asc'),
      supabase('social_links?is_active=eq.true&select=label,url,display_order&order=display_order.asc'),
      supabase('website_sections?is_visible=eq.true&select=page_slug,section_key,content,display_order&order=display_order.asc'),
    ]);
    return json(res, 200, { policies, socials, sections });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Site content is temporarily unavailable.' });
  }
};
