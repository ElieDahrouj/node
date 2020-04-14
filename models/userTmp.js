const mongoose = require('mongoose')
const Schema = mongoose.Schema

const userTmpSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    token: {
        type: String,
        required: true,
        expires: '1m',
    },
    createdAt: {
        type: Date,
        expires: '1h',
        default: Date.now
    }
}, {collection: 'userTmp'}) // Nomme la collection
userTmpSchema.methods.validPassword = function (password) {
    return this.password === password
}
const UserTmp = mongoose.model('UserTmp', userTmpSchema)

module.exports = UserTmp