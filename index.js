require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_KEY);

app.use(express.json());
app.use(
  cors({
    origin: ["https://foodparadise-9f663.web.app"],
  })
);

app.get("/", async (req, res) => {
  res.send("Working Service");
});

app.listen(port, async (req, res) => {
  console.log(`server is running at ${port}`);
});

/**
 * ---------------------------
 *
 *     NAMING CONVENTION
 * ------------------------------
 *
 * app.get('/users')
 * app.get('/users/:id')
 * app.post('/users')
 * app.put('/users/:id')
 * app.patch('/users/:id')
 * app.delete('users/:id')
 *
 *
 */

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.t9lecvs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const menuCollection = client.db("foodparadiseDB").collection("menu");
    const reviewCollection = client.db("foodparadiseDB").collection("reviews");

    const cartCollection = client.db("foodparadiseDB").collection("cart");
    const userCollection = client.db("foodparadiseDB").collection("users");
    const paymentCollection = client
      .db("foodparadiseDB")
      .collection("payments");

    // middlewares

    const verifyToken = (req, res, next) => {
      console.log("inside verifyToken", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.Access_Token_Secret, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);

      const isAdmin = user?.role === "admin";

      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // meu related api
    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;

      const result = await menuCollection.insertOne(item);

      res.send(result);
    });
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });
    // review section
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });
    app.post("/reviews", async (req, res) => {
      const review = req.body;

      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    app.delete("/menu/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    // jwt related api

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.Access_Token_Secret, {
        expiresIn: "24h",
      });
      res.send({ token });
    });

    // user related api

    app.get(
      "/users/admin/:email",
      verifyToken,

      async (req, res) => {
        const email = req.params.email;

        const query = { email: email };
        const user = await userCollection.findOne(query);

        let admin = false;

        if (user) {
          admin = user?.role === "admin";
        }

        res.send({ admin });
      }
    );

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers.authorization);
      const result = await userCollection.find().toArray();

      res.send(result);
    });
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "admin",
          },
        };

        const result = await userCollection.updateOne(query, updateDoc);
        res.send(result);
      }
    );
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user?.email };

      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "already exists", insertedId: null });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //cart collection
    app.get("/carts", verifyToken, async (req, res) => {
      const email = req.query.email;

      const query = {
        email: email,
      };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/carts", verifyToken, async (req, res) => {
      const cartItem = req.body;

      const result = await cartCollection.insertOne(cartItem);

      res.send(result);
    });

    app.delete("/carts/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;

      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,

        currency: "usd",
        payment_method_types: ["card"],
      });

      res.status(200).send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    // payment related api
    app.get("/payments/:email", async (req, res) => {
      const query = { email: req.params.email };

      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      console.log("payment info", payment);

      // carefully delete each item fromm cart

      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };

      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });
    });

    // stats or analytics

    //User Home
    app.get("/user-stats/:email", async (req, res) => {
      const query = { email: req.params.email };

      const cart = cartCollection.find(query).toArray();
      res.send(cart);
    });
    app.get("/admin-stats", async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,

              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        menuItems,
        orders,
        revenue,
      });
    });
    /**
     * order status
     * load all the payments
     * for every menuItems(which in arrays).

     */

    app.get("/order-stats", async (req, res) => {
      const result = await paymentCollection
        .aggregate([
          { $unwind: "$menuItemIds" },

          {
            $lookup: {
              from: "menu",
              localField: "menuItemIds",
              foreignField: "_id",
              as: "menuItems",
            },
          },

          // {
          //   $group: {
          //     _id: "$menuItems.category",

          //     quantity: { $sum: 1 },
          //    revenue:{$sum:'$menuItems.price'}
          //   },
          // },
          // {
          //   $project:{
          //     _id:0,
          //     category:"$_id",
          //     quantity: "$quantity",
          //     revenue: "$revenue"
          //   }
          // }
        ])
        .toArray();

      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
