const { env, json, supabase, supabasePublic } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const [policies, socials, sections, services, gallery, categories, sectionVisibility] = await Promise.all([
      supabasePublic('policies?is_visible=eq.true&select=policy_key,title,body,display_order&order=display_order.asc'),
      supabasePublic('social_links?is_active=eq.true&select=label,url,display_order&order=display_order.asc'),
      supabasePublic('website_sections?is_visible=eq.true&select=page_slug,section_key,content,display_order&order=display_order.asc'),
      supabasePublic('services?is_active=eq.true&select=id,name,slug,description,notes,preparation_instructions,image_path,category:service_categories(name,slug),lengths:service_lengths(id,name,price,display_order),options:service_options(name,price_delta,display_order,is_active)&order=display_order.asc'),
      supabasePublic('gallery_items?is_active=eq.true&select=id,image_path,caption,alt_text,category,display_order&order=display_order.asc'),
      supabasePublic('service_categories?is_active=eq.true&select=id,name,slug,display_order&order=display_order.asc'),
      supabase('website_sections?page_slug=eq.home&select=section_key,is_visible,display_order&order=display_order.asc'),
    ]);
    const mediaBase = `${env('SUPABASE_URL')}/storage/v1/object/public/hair-media/`;
    const publicMediaUrl = (path) => path && path.startsWith('http') ? path : path ? `${mediaBase}${String(path).replace(/^\/+/, '')}` : '';
    return json(res, 200, { policies, socials, sections, sectionVisibility, services: services.map((item) => ({ ...item, image_url: publicMediaUrl(item.image_path) })), categories, gallery: gallery.map((item) => ({ ...item, public_url: publicMediaUrl(item.image_path) })) });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Site content is temporarily unavailable.' });
  }
};
