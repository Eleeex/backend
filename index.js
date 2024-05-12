const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const { type } = require("os");

app.use(express.json());
app.use(cors());

//Database connection mongoDB

mongoose.connect("mongodb://arkshy10:user123@ac-qw7ztfe-shard-00-00.m1l8nza.mongodb.net:27017,ac-qw7ztfe-shard-00-01.m1l8nza.mongodb.net:27017,ac-qw7ztfe-shard-00-02.m1l8nza.mongodb.net:27017/EANDVR?ssl=true&replicaSet=atlas-kjyjj1-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0")
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((error) => {
        console.error("Error connecting to MongoDB:", error);
    });


// API Creation

app.get("/", (req, res)=>{
    res.send("Express app is Running")
})

//Image storage engine

const storage = multer.diskStorage({
    destination:'./upload/images',
    filename:(req,file,cb)=>{
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({storage:storage});

//Creating endpoint for images
app.use('/images', express.static('upload/images'))
app.post("/upload", upload.single('product'), (req, res)=>{
    res.json({
        success:1,
        image_url:`http://localhost:${port}/images/${req.file.filename}`
    })
})

const Product = mongoose.model("Product", {
    id:{
        type: Number,
        required: true,
    },
    name:{
        type: String,
        required: true,
    },
    image:{
        type: String,
        required: true,
    },
    category:{
        type: String,
        required:true,
    },
    new_price:{
        type: Number,
        required:true,
    },
    old_price:{
        type: Number,
        required:true,
    },
    date:{
        type:Date,
        default:Date.now,
    },
    available:{
        type:Boolean,
        default:true,
    },

})

app.post('/addproduct', async(req,res)=>{
    let products = await Product.find({});
    let id;
    if(products.length>0){
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id+1;
    }else{
        id = 1;
    }
    const product = new Product({
        id:id,
        name:req.body.name,
        image:req.body.image,
        category:req.body.category,
        new_price:req.body.new_price,
        old_price:req.body.old_price,
    });
    console.log(product);
    await product.save();
    console.log("Saved");
    res.json({
        success:true,
        name:req.body.name,
    })
})

//Creating API for deleting products
app.post('/removeproduct', async(req, res)=>{
    await Product.findOneAndDelete({id:req.body.id});
    console.log("Removed");
    res.json({
        success:true,
        name:req.body.name
    })
})

//Creating API for getting all products
app.get('/allproducts', async(req, res)=>{
    let products = await Product.find({});
    console.log("All products Fetched");
    res.send(products);
})


//Schema Creating for user Model
const User = mongoose.model('User', {
    name: {
        type: String,
    },
    email: {
        type: String,
        unique: true,
    },
    password: {
        type: String,
    },
    cartData: {
        type: Map,
        of: Number, // Assuming you're storing quantities as numbers
        default: {}
    },
    date: {
        type: Date,
        default: Date.now,
    },
});


//Creating endpoint for registering user
app.post('/signup', async(req, res)=>{
    let check = await User.findOne({ email:req.body.email});
    if(check) {
        return res.status(400).json({
            success:false,
            errors:"Existing user found with same email",
        });
    }
    let cart = {};
    for(let i = 0; i<300; i++){
        cart[i] = 0;
    }
    const user = new User({
        name:req.body.name,
        email:req.body.email,
        password:req.body.password,
        cartData:cart,
    })

    await user.save();
    const data = {
        user:{
            id: user.id,
        },
    };
    const token = jwt.sign(data, "secret_ecom");
    res.json({sucess:true, token})
})

//  Creating endpoint for user login
app.post('/login', async(req, res)=>{
    let user = await User.findOne({email:req.body.email})
    if(user){
    const passMatch = req.body.password === user.password;
    if(passMatch){
        const data = {
            user: {
                id:user.id,
            },
        };
        const token = jwt.sign(data, "secret_ecom");
        res.json({success:true, token});
    }else{
        res.json({success:false, errors: "Wrong Password"});
    }
    }else{
        res.json({success:false, errors: "Wrong Email address"});
    }
});

//  Creating endpoint for newcollection data
app.get('/newcollections', async (req, res)=>{
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("NewCollection Fetched");
    res.send(newcollection);
})
//  Creating endpoint for popularproduct in clothing
app.get('/popularproducts', async (req, res)=>{
    let products = await Product.find({ category: 'clothing'});
    let popularproducts = products.slice(0, 4);
    console.log("Popularproducts Fetched");
    res.send(popularproducts);
})

//Creating middleware to fetch user
const fetchUser = async (req, res, next)=> {
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({errors: "Please authenticate using valid login "});
    }else {
        try{
             const data = jwt.verify(token, "secret_ecom");
             req.user = data.user;
             next();
        } catch (error) {
            res.status(401).send({errors: "Please authenticate using valid token"});

        }
    }
};

//Creating endpoint for adding products in cartdata
app.post('/addcart', fetchUser, async (req, res) => {
    try {
        const itemId = req.body.itemId;
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Increment the quantity for the item in cartData
        user.cartData[itemId] = (user.cartData[itemId] || 0) + 1;
        
        // Save the updated user data
        await user.save();
        
        res.json({ success: true, message: "Item added to cart" });
    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({ error: "An error occurred" });
    }
});


//Creatingendpoint for remove product
app.post('/addcart', fetchUser, async (req, res) => {
    try {
        console.log("Adding to cart:", req.body.itemId);
        let userData = await User.findOne({ _id: req.user.id });
        
        if (!userData) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Make sure the cartData object exists
        if (!userData.cartData) {
            userData.cartData = {};
        }

        // Increment the item count in the cart
        userData.cartData[req.body.itemId] = (userData.cartData[req.body.itemId] || 0) + 1;

        // Save the updated user data
        await userData.save();

        res.json({ success: true, message: "Item added to cart" });
    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({ error: "An error occurred" });
    }
});

 


app.listen(port, (error)=>{
    if(!error) {
        console.log("Server is Running on Port " +port)
    }else{
        console.log("Error: " +error)
    }
})