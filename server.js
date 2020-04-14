const express = require('express')
const helmet = require('helmet')
const bodyParser = require('body-parser')
const User = require('./models/user')
const UserTmp = require('./models/userTmp')
const passport = require('passport')
const session = require('express-session')
const LocalStrategy = require ('passport-local').Strategy
const urlencoded = bodyParser.urlencoded({extended:false})
const mongoose = require('mongoose')
const app = express()
require('dotenv').config()
const {APP_PORT, APP_KEY, APP_SECRET , APP_USER, APP_PASSWORD} = process.env
const port = APP_PORT
const nodemailer = require("nodemailer");
app.use(helmet())
app.use(express.static('assets'))
app.use(session({secret:APP_SECRET,resave:false,saveUninitialized:false}))
app.use(passport.initialize())
app.use(passport.session())
passport.serializeUser((user,done)=>{
    done(null,user)
})
passport.deserializeUser((user,done)=>{
    done(null,user)
})

passport.use(new LocalStrategy({usernameField:'email'},
    (email, password, done) => {
        User.findOne({ email: email }, (err, user) => {
            if (err) { return done(err); }
            if (!user) { return done(null, false); }
            if (!user.validPassword(password)) { return done(null, false); }
            return done(null, user);
        });
    }
));

mongoose.set('useFindAndModify',false)
mongoose.connect(APP_KEY,
{useNewUrlParser:true ,useUnifiedTopology: true})

const db = mongoose.connection
db.on('error',console.error.bind(console,'ERROR: CANNOT CONNECT TO MONGO-BD'))
db.once('open',()=>console.log('CONNECTED TO MONGO-DB'))

app.get('/signin',(req,res)=>{
    if (req.user) return res.redirect('/user')
    res.render('signin.pug')
})

app.get('/',(req,res)=>{
    if (req.user) return res.redirect('/user')
    res.render('signup.pug')
})

app.get('/user',async(req,res)=>{
    if (!req.user) return res.redirect('/signin')
    try {
        const users = await User.find({}).select('_id name email')
        return res.render('users.pug', {
            allUsers: users,
            nameUserConnected : req.user.name
        })
    }
    catch (e) {
        res.status(500).send('Erreur pour liste utilisateurs.')
    }
})

app.get('/user/:_id', async (req,res)=>{
    try {
        const oneUser= await User.findById(req.params._id).select('_id name email')
        return res.render('user.pug', {
            allUser: oneUser,
        })
    }
    catch (e) {
        res.status(500).send('Erreur pour utilisateur.')
    }
})
app.post('/signin',urlencoded, passport.authenticate('local',{
    successRedirect:'/user',
    failureRedirect:'/signin'
}))
app.get('/confirm/:token', async (req, res) => {
    try {
        const {token} = req.params
        const {name,password, email}= await UserTmp.findOneAndDelete({token}).select('name password email')
        const newUser = new User({name, password, email})
        const newU = await newUser.save()
        if (newU)
        res.status(200).send('Confirmation réussi')
    } catch (e) {
        res.status(500).send('Erreur pour utilisateur.')
    }
})
app.post('/', urlencoded, async (req, res) => {
    const {name, password, email} = req.body
    try {
        const existing = await User.findOne({email})
        if (existing){
            return res.render('signup.pug',{
                error : `l\'email ${existing.email} est déjà pris`
            })
        }
    } catch (e) {
        return res.status(500).send('Erreur du serveur.')
    }

    try {
        let token = generate_token(15)
        const userConfirm = new UserTmp({name, password, email, token})
        const newU = await userConfirm.save()
        const mail = {
            from: 'nodemailerwebstart@gmail.com', // sender address
            to: newU.email, // list of receivers
            subject: 'Confirmation d\'inscription', // Subject line
            html: `<span>Cliquez sur le lien pour confirmer <a href="http://localhost:3000/confirm/${userConfirm.token}">${userConfirm.token}</a></span>`
        };
        await transporter.sendMail(mail, function (err, info) {
            if (err)
                console.log(err)
        });
        if (newU){
            return res.render('signup.pug',{
                msg : `Un email a été envoyé à ${newU.email}`,
            })
        }
    } catch (e) {
        return res.status(500).send('Erreur du serveur.')
    }
})
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: APP_USER,
        pass: APP_PASSWORD
    }
});
function generate_token(length){
    let a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".split("");
    let b = [];
    for (let i=0; i<length; i++) {
        let j = (Math.random() * (a.length-1)).toFixed(0);
        b[i] = a[j];
    }
    return b.join("");
}
app.put('/user/:_id',urlencoded,async (req,res)=>{
    const {name, password} = req.body
    try {
        const updateUser = await User.findByIdAndUpdate(req.params._id, {$set: {name, password}}, {new:true})
        if (!updateUser) return res.status(404).send('no user')
        const userUpdated = {_id:updateUser.id, name:updateUser.name}
        return res.send(`utilisateur ${userUpdated._id} modifié : ${userUpdated.name}`)
    }
    catch (e) {
        return res.status(500).send('error')
    }
    /*User.findByIdAndUpdate(req.params._id, {$set: {name, password}}, {new:true}, (err,user)=>{
        if (err) return res.status(500).send('error')
        if (!user) return res.status(404).send('no user')
        const userUpdated = {_id:user.id, name:user.name}
        return res.send(`utilisateur ${userUpdated._id} modifié : ${userUpdated.name}`)
    })*/
})
app.delete('/user/:_id',urlencoded,async (req,res)=>{
    try {
        const deleteUSer = await User.findByIdAndDelete(req.params._id)
        if (!deleteUSer) return res.status(404).send('no user')
        return res.send(`utilisateur ${deleteUSer.name} supprimé`)
    }
    catch (e) {
            return res.status(500).send('error')
    }
    /*User.findByIdAndDelete(req.params._id,(err,user)=>{
        if (err) return res.status(500).send('error')
        if (!user) return res.status(404).send('no user')
        return res.send(`utilisateur ${user.name} supprimé`)
    })*/
})

app.post('/user/delete/:_id', async (req, res) => {
    const { _id } = req.params
    try {
        const user = await User.findByIdAndDelete(_id)
        if (!user) {
            return res.status(404).send(`Il n’y a pas d’utilisateur`)
        }
        res.redirect('/user')
    } catch (err) {
        return res.status(500).send('Erreur du serveur')
    }
})
app.get('/signout', (req, res) => {
    req.logout();
    res.redirect('/signin');
})

app.get('*', (req, res) => {
    res.status(404).send('Cette page n’existe pas !')
})
app.listen(3000,()=>console.log(`serveur lancé sur le ${port}`))
