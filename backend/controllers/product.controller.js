import { redis } from "../lib/redis.js";
import cloudinary from "../lib/cloudinary.js";
import Product from "../models/product.model.js"

export const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find({}); // find all products
        res.json({ products });
    } catch (error) {
        console.log("Error in getAll products controller", error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
}

export const getFeaturedProducts = async (req, res) => {
    try {
        let featuredProducts = await redis.get("featured_products")
        if (featuredProducts) {
            return res.json(JSON.parse(featuredProducts));
        }

        //if not in redis, fetch from mongo db
        //.lean is gonna return a plain javascript object instead of a mongodb doc perf++
        featuredProducts = await Product.find({ isFeatured: true }).lean();

        if (!featuredProducts) {
            return res.status(404).json({ message: "No featured products found" });
        }

        //store in redis on the way for future quick access
        await redis.set("featured_products", JSON.stringify(featuredProducts));

        res.json(featuredProducts);

    } catch (error) {

    }
}

export const createProduct = async (req, res) => {
    try {
        const { name, description, price, image, catergory } = req.body;

        let cloudinaryResponse = null
        if (image) {
            cloudinaryResponse = await cloudinary.uploader.upload(image, { folder: "products" })
        }

        const product = await Product.create({
            name,
            description,
            price,
            image: cloudinaryResponse?.secure_url ? cloudinaryResponse.secure_url : "",
            catergory
        })

        res.status(201).json(product)
    } catch (error) {
        console.log("Error in create product controller", error.message);
        res.status(500).json({
            message: "server error", error: error.message
        });
    }
}

export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (product.image) {
            const publicId = product.image.split("/").pop().split(".")[0]; //this will get the id of the image
            try {
                await cloudinary.uploader.destroy(`products/${publicId}`)
                console.log("deleted image from cloudinary")
            } catch (error) {
                console.log("Error deleting image from cloudinary", error)
            }
        }

        await Product.findByIdAndDelete(req.params.id)

        res.json({ message: "Product Deleted Successfully" });

    } catch (error) {
        console.log("Error in delete product controller", error.message);
        res.status(500).json({ message: "Server error", error: error.message })
    }
}

export const getRecommendedProducts = async (req, res) => {
    try {
        const products = await Product.aggregate([
            {
                $sample: { size: 3 }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    image: 1,
                    price: 1
                }
            }
        ])
        res.json(products)
    } catch (error) {
        console.log("Error in recommendations", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
}

export const getProductsByCategory = async (req, res) => {
    const { category } = req.params;
    try {
        const products = await Product.find({ category });
        res.json(products);
    } catch (error) {
        console.log("Error in getproductsbycategory", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
}

export const toggleFeaturedProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            product.isFeatured = !product.isFeatured;
            const updatedProduct = await product.save();
            //update redis
            await updateFeaturedproductsCache();
            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: "product not found" });
        }
    } catch (error) {
        console.log("error toggle feature product", error.message);
        res.status(500).json({ message: "Error Server", error: error.message });
    }
}

async function updateFeaturedproductsCache() {
    try {
        const featuredProducts = await Product.find({ isFeatured: true }).lean();
        await redis.set("featured_products", JSON.stringify(featuredProducts));
    } catch (error) {
        console.log("error in update cache function");
    }
}