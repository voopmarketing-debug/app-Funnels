-- Extra photos of a product from other angles (the website's 360° viewer turns
-- through them). Additive: one column with an empty default, nothing is changed
-- or removed.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
