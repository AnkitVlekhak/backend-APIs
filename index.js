import express from "express";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from 'uuid';
import mongoose from "mongoose";
import dotenv from "dotenv";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))
dotenv.config();
mongoose
    .connect(process.env.MONGO_DB, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() =>
        app.listen(process.env.PORT, () =>
            console.log(`Listening at ${process.env.PORT}`)
        )
    )
    .catch((error) => console.log(error));

const studentSchema = mongoose.Schema(
    {
        universityID: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        uniqueId: String,
    }
)
const studentModal = mongoose.model("Students", studentSchema);

const deanSchema = mongoose.Schema({
    universityID: { type: String, required: true, unique: true },
    uniqueId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    availableSlots: [{ day: String, time: String }],
    pendingSessions: [{ day: String, time: String, name: String }],
});

const deanModal = mongoose.model('Deans', deanSchema);

app.post('/api/auth/student', async (req, res) => {
    const universityID = req.body.id;
    const pswd = req.body.password;
    var token = uuidv4();
    const oldUser = await studentModal.findOne({ universityID });
    const newStudent = new studentModal({
        universityID: universityID,
        password: pswd,
        uniqueId: token,
    });
    if (!oldUser) {
        newStudent.save().then(function (doc) {
            console.log(doc._id.toString());
        }).catch(function (error) {
            console.log(error);
        });
    } else {
        token = oldUser.uniqueId;
    }
    res.setHeader('Authorization', 'Bearer ' + token);
    res.status(200).json("TOKEN GENERATED")
})

app.post('/api/auth/dean', async (req, res) => {
    const universityID = req.body.id;
    const pswd = req.body.password;
    const token = uuidv4();
    const newDean = new deanModal({
        universityID: universityID,
        password: pswd,
        uniqueId: token,
        availableSlots: [
            { day: 'Thursday', time: '10:00 AM' },
            { day: 'Friday', time: '10:00 AM' },
        ],
    })
    const oldUser = await deanModal.findOne({ universityID });
    if (!oldUser) {
        newDean.save().then(function (doc) {
            // console.log(doc._id.toString());
        }).catch(function (error) {
            console.log(error);
        });
    } else {
        token = oldUser.uniqueId;
    }
    res.setHeader('Authorization', 'Bearer ' + token);
    res.status(200).json("TOKEN GENERATED")
})

app.get('/api/dean/slots', async (req, res) => {
    var authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(404).json("UnAuthorised Access")
    } else {
        const student = await studentModal.findOne({ uniqueId: req.headers.authorization.split(' ')[1] });
        if (!student) {
            return res.status(400).json("UnAuthorised Access. Incorrect Token");
        }
    }
    const deanID = req.query.deanID;
    try {
        const dean = await deanModal.findOne({ universityID: deanID })
        res.status(200).json({ "available sessions": dean.availableSlots })
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
})

app.post('/api/dean/book', async (req, res) => {
    var authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(404).json("UnAuthorised Access")
    } else {
        const student = await studentModal.findOne({ uniqueId: req.headers.authorization.split(' ')[1] });
        if (!student) {
            return res.status(400).json("UnAuthorised Access. Incorrect Token");
        }
    }
    const n = req.body.name;
    console.log(n);
    const sessionID = req.query.sessionID;
    var nar;
    try {
        const sessions = await deanModal.find({
            'availableSlots._id': `${sessionID}`,
        });
        const arr = sessions[0].availableSlots;
        const a = arr.filter((e, i) => {
            if (e._id != sessionID) {
                return true;
            } else {
                nar = e
            }
        })
        nar = { ...nar };
        nar._doc.name = n;
        const doc = await deanModal.updateOne({ _id: sessions[0]._id }, {
            availableSlots: a,
            pendingSessions: [...sessions[0].pendingSessions, nar],
        })
        return res.status(200).json("Session booked");
    } catch (error) {
        res.status(404).json({ message: error.message });
    }


})

app.post('/api/dean/empty', async (req, res) => {
    var authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(404).json("UnAuthorised Access")
    } else {
        const dean = await deanModal.findOne({ uniqueId: req.headers.authorization.split(' ')[1] });
        if (!dean) {
            return res.status(400).json("UnAuthorised Access. Incorrect Token");
        }
    }
    const sessionID = req.query.sessionID;
    var nar;
    try {
        const sessions = await deanModal.find({
            'pendingSessions._id': `${sessionID}`,
        });
        const arr = sessions[0].pendingSessions;
        const a = arr.filter((e, i) => {
            if (e._id != sessionID) {
                return true;
            } else {
                nar = e
            }
        })

        const doc = await deanModal.updateOne({ _id: sessions[0]._id }, {
            availableSlots: [...sessions[0].availableSlots, nar],
            pendingSessions: a,
        })
        return res.status(200).json("Session emptied");
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
})

app.get('/api/dean/pending-sessions', async (req, res) => {
    var authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(404).json("UnAuthorised Access")
    } else {
        const dean = await deanModal.findOne({ uniqueId: req.headers.authorization.split(' ')[1] });
        if (!dean) {
            return res.status(400).json("UnAuthorised Access. Incorrect Token");
        }
    }
    const dean = await deanModal.findOne({ uniqueId: req.headers.authorization.split(' ')[1] });
    res.status(200).json({ 'pending-sessions': dean.pendingSessions })
})

