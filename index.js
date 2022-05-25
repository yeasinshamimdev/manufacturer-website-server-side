const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
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

        app.post('/booking', verifyJWT, async (req, res) => {
            const data = req.body;
            const result = await bookingCollection.insertOne(data);
            res.send(result);
        });

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