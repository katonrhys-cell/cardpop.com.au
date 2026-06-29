import logger from '../utils/logger.js';
import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';

const router = Router();

// Generate sitemap for products
router.get('/products', async (req, res) => {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('id, updated')
            .eq('status', 'active')
            .order('updated', { ascending: false })
            .limit(5000);

        if (error) throw error;

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${products?.map(product => `  <url>
    <loc>https://cardpop.com.au/shop/product/${product.id}</loc>
    <lastmod>${new Date(product.updated).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n') || ''}
</urlset>`;

        res.set('Content-Type', 'application/xml');
        res.send(xml);
    } catch (error) {
        logger.error('Error generating products sitemap:', error);
        res.status(500).send('Error generating sitemap');
    }
});

// Generate sitemap for vault listings
router.get('/listings', async (req, res) => {
    try {
        const { data: listings, error } = await supabase
            .from('listings')
            .select('id, updated')
            .eq('status', 'active')
            .order('updated', { ascending: false })
            .limit(5000);

        if (error) throw error;

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${listings?.map(listing => `  <url>
    <loc>https://cardpop.com.au/vault/listing/${listing.id}</loc>
    <lastmod>${new Date(listing.updated).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n') || ''}
</urlset>`;

        res.set('Content-Type', 'application/xml');
        res.send(xml);
    } catch (error) {
        logger.error('Error generating listings sitemap:', error);
        res.status(500).send('Error generating sitemap');
    }
});

// Generate sitemap for blog posts
router.get('/blog', async (req, res) => {
    try {
        const { data: posts, error } = await supabase
            .from('blog_articles')
            .select('id, slug, updated')
            .eq('is_published', true)
            .order('updated', { ascending: false })
            .limit(500);

        if (error) throw error;

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${posts?.map(post => `  <url>
    <loc>https://cardpop.com.au/blog/${post.slug || post.id}</loc>
    <lastmod>${new Date(post.updated).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n') || ''}
</urlset>`;

        res.set('Content-Type', 'application/xml');
        res.send(xml);
    } catch (error) {
        logger.error('Error generating blog sitemap:', error);
        res.status(500).send('Error generating sitemap');
    }
});

// Generate sitemap index that references all sitemaps
router.get('/index', async (req, res) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://cardpop.com.au/sitemap.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://cardpop.com.au/api/sitemap/products</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://cardpop.com.au/api/sitemap/listings</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://cardpop.com.au/api/sitemap/blog</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
</sitemapindex>`;

    res.set('Content-Type', 'application/xml');
    res.send(xml);
});

export default router;
