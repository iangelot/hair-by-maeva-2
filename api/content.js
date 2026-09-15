const { env, json, supabase } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const [policies, socials, sections, services, gallery] = await Promise.all([
      supabase('policies?is_visible=eq.true&select=policy_key,title,body,display_order&order=display_order.asc'),
      supabase('social_links?is_active=eq.true&select=label,url,display_order&order=display_order.asc'),
      supabase('website_sections?is_visible=eq.true&select=page_slug,section_key,content,display_order&order=display_order.asc'),
      supabase('services?is_active=eq.true&select=id,name,slug,description,image_path,category:service_categories(name,slug),lengths:service_lengths(name,price,display_order)&order=display_order.asc'),
      supabase('gallery_items?is_active=eq.true&select=id,image_path,caption,alt_text,category,display_order&order=display_order.asc'),
    ]);
    const mediaBase = `${env('SUPABASE_URL')}/storage/v1/object/public/hair-media/`;
    return json(res, 200, { policies, socials, sections, services, gallery: gallery.map((item) => ({ ...item, public_url: item.image_path.startsWith('http') ? item.image_path : `${mediaBase}${item.image_path}` })) });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Site content is temporarily unavailable.' });
  }
};
