const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w8qsv.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// verify jwt
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        await client.connect();
        const partsCollection = client.db("car-parts").collection("parts");
        const bookingCollection = client.db("car-parts").collection("booking");
        const paymentCollection = client.db("car-parts").collection("payment");
        const reviewCollection = client.db("car-parts").collection("review");
        const userCollection = client.db("car-parts").collection("users");

        // jwt token 
        app.post('/login', async (req, res) => {
            const email = req.body;

            const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '4d'
            });
            res.send({ token })
        });

        app.get('/parts', async (req, res) => {
            const parts = await partsCollection.find({}).toArray();
            res.send(parts);
        });

        app.get('/payment', verifyJWT, async (req, res) => {
            const payment = await paymentCollection.find({}).toArray();
            res.send(payment);
        })

        app.put('/parts/:id', verifyJWT, async (req, res) => {
            const data = req.body;
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };

            const updateDoc = {
                $set: {
                    availableQuantity: data.availableQuantity,
                    minimumQuantity: data.minimumQuantity
                }
            };
            const result = await partsCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })

        app.get('/parts/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const part = await partsCollection.findOne(query);
            res.send(part);
        });

        app.get('/booking/:email', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { userEmail: email }
            const booking = await bookingCollection.find(query).toArray();
            res.send(booking);
        });

        app.get('/review', async (req, res) => {
            const review = await reviewCollection.find({}).toArray();
            res.send(review);
        });

        app.put('/users/:email', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const { formData } = req.body;
            const filter = { userEmail: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    userName: formData.userName,
                    userEmail: formData.userEmail,
                    education: formData.education,
                    location: formData.location,
                    phone: formData.phone,
                    linkedin: formData.linkedin,
                }
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })

        app.post('/review', verifyJWT, async (req, res) => {
            const { data } = req.body;
            const result = await reviewCollection.insertOne(data);
            res.send(result);
        });

        app.post('/booking', verifyJWT, async (req, res) => {
            const data = req.body;
            const result = await bookingCollection.insertOne(data);
            res.send(result);
        });

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        app.patch('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const result = await paymentCollection.insertOne(payment);
            const updatedBooking = await bookingCollection.updateOne(filter, updatedDoc);
            res.send(updatedBooking);
        })

        app.delete('/booking/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })

    }
    finally { }
}
run().catch(console.dir);


app.get('/', async (req, res) => {
    res.send('car parts manufacture server running.');
})

app.listen(port, () => {
    console.log('Listening port,', port);
});