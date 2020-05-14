const functions = require('firebase-functions');
const app = require('express')();
const FBAtuh = require('./util/fbAuth');

const cors = require('cors')
app.use(cors());

const { db } = require('./util/admin');

const { 
    getAllPosts, 
    createPost, 
    getPost, 
    commentOnPost,
    likePost,
    unlikePost,
    deletePost
} = require('./handlers/posts');

const { 
    signup,
    login,
    uploadImage, 
    addUserDetails,
    getAuthenticatedUser,
    getUserDetails,
    markNotificationsRead
} = require('./handlers/users')

// Post route 
app.get('/posts', getAllPosts);
app.post('/post', FBAtuh, createPost);
app.get('/post/:postId', getPost);
app.delete('/post/:postId', FBAtuh, deletePost);
app.get('/post/:postId/like', FBAtuh, likePost);
app.get('/post/:postId/unlike', FBAtuh, unlikePost);
app.post('/post/:postId/comment', FBAtuh, commentOnPost);

// Users route
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAtuh, uploadImage);
app.post('/user', FBAtuh, addUserDetails);
app.get('/user', FBAtuh, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAtuh, markNotificationsRead);


exports.api = functions.region('europe-west1').https.onRequest(app);


exports.createNotificationOnLike = functions
.region('europe-west1')
.firestore.document('likes/{id}')
.onCreate((snapshot) => {
    return db.doc(`/posts/${snapshot.data().postId}`)
    .get()
    .then( (doc) => {
        if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
            return db.doc(`/notifications/${snapshot.id}`).set({
                createdAt: new Date().toISOString(),
                recipient: doc.data().userHandle,
                sender: snapshot.data().userHandle,
                type: 'like',
                read: false,
                postId: doc.id
            });
        }
    })
    .catch(err=> {
        console.error(err);
    });
});


exports.deleteNotificationsOnUnLike = functions
.region('europe-west1')
.firestore.document('likes/{id}')
.onDelete((snapshot) =>{
    return db.doc(`/notifications/${snapshot.id}`)
    .delete()
    .catch((err) => {
        console.error(err);
        return;
    });
});


exports.createNotificationOnComment = functions
.region('europe-west1')
.firestore.document('comments/{id}')
.onCreate((snapshot) => {
    return db
    .doc(`/posts/${snapshot.data().postId}`)
    .get()
    .then( (doc) => {
        if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
            return db.doc(`/notifications/${snapshot.id}`).set({
                createdAt: new Date().toISOString(),
                recipient: doc.data().userHandle,
                sender: snapshot.data().userHandle,
                type: 'comment',
                read: false,
                postId: doc.id
            });
        }
    })
    .catch((err) => {
        console.error(err);
        return;
    });
});


exports.onUserImageChange = functions
.region('europe-west1')
.firestore.document('/users/{userId}')
.onUpdate((change) => {
    console.log("Before upload");
    console.log(change.before.data());
    console.log("After upload");
    console.log(change.after.data());

    if(change.before.data().imageUrl !== change.after.data().imageUrl) {
        console.log('Image has changed');
        
        let batch = db.batch();
        return db
        .collection('posts')
        .where('userHandle', '==', change.before.data().handle)
        .get()
        .then((data) => {
            data.forEach((doc) => {
                const post = db.doc(`/posts/${doc.id}`);
                batch.update(post, {userImage: change.after.data().imageUrl });
            });
            return batch.commit();
        });
    }
    else return true;
});


exports.onPostDelete = functions
.region('europe-west1')
.firestore.document('/posts/{postId}')
.onDelete((snapshot, context) => {
    const postId = context.params.postId;
    const batch = db.batch();
    return db
    .collection('comments')
    .where('postId', '==', postId).get()
    .then((data) => {
        data.forEach((doc) => {
            batch.delete(db.doc(`/comments/${doc.id}`));
        })
        return db
        .collection('likes')
        .where('postId', '==', postId)
        .get();
    })
    .then((data) => {
        data.forEach((doc) => {
            batch.delete(db.doc(`/likes/${doc.id}`));
        })
        return db.collection('notifications').where('postId', '==', postId).get();
    })
    .then((data) => {
        data.forEach(doc => {
            batch.delete(db.doc(`/notifications/${doc.id}`));
        })
        return batch.commit();
    })
    .catch((err) => {
        console.error(err);
    });
});




















// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });


// exports.getPosts = functions.https.onRequest((req, res) => {
//     admin.firestore().collection('posts').get()
//     .then(data => {
//         let posts = [];
//         data.forEach(doc => {
//             posts.push(doc.data());
//         });
//         return res.json(posts)
//     })
//     .catch((err) => console.error(err));   
// })


// app.get('/posts', (req, res) => {
//     db.collection('posts').orderBy('createdAt', 'desc').get()
//     .then(data => {
//         let posts = [];
//         data.forEach(doc => {
//             posts.push({
//                 postId: doc.id,
//                 body: doc.data().body,
//                 userHandle: doc.data().userHandle,
//                 createdAt: doc.date().createdAt
//             });
//         });
//         return res.json(posts)
//     })
//     .catch((err) => {
//            console.error(err);
//        )};   
// })


// const FBAtuh = (req, res, next) => {
//     let idToken;

//     if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')){
//         idToken = req.headers.authorization.split('Bearer ')[1];
//     }
//     else {
//         console.error('No token found')
//         return res.status(403).json({ errors: 'Unauthorized'});
//     }

//     admin.auth().verifyIdToken(idToken)
//     .then((decodedToken) => {
//         req.user = decodedToken;
//         console.log(decodedToken);

//         return db.collection('users')
//         .where('userId', '==', req.user.uid)
//         .limit(1)
//         .get();
//     })
//     .then((data) => {
//         req.user.handle = data.docs[0].data().handle;
//         return next();
//     })
//     .catch((err) => {
//         console.error('Error while verifying token', err);
//         return res.status(403).json(err);
//     })
// }




// exports.createPost = functions.https.onRequest((req, res) => {
    // if(req.method != 'POST'){
    //     return res.status(400).json({ error: 'Method not allowed'});
    // }

// app.post('/post', FBAtuh, (req, res) => {
//     if(req.body.body.trim() === ''){
//         return res.status(400).json({ body: 'Body must not be empty'});
//     }

//     const newPost = {
//         body: req.body.body,
//         userHandle: req.user.handle,
//         createdAt: new Date().toISOString()
//     };

//     db.collection('posts').add(newPost)
//     .then((doc) => {
//         res.json({message: `document ${doc.id} created successfully`});
//     })
//     .catch((err) => {
//         res.status(500).json({ error: 'Something went wrong'});
//         console.error(err);
//     });  
// });


// const isEmail = (email) => {
//     const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
//     if(email.match(regEx)) return true;
//     else return false;
// }

// const isEmpty = (string) => {
//     if(string.trim() === '') return true;
//     else return false;
// }

// Signup route
// app.post('/signup', (req, res) => {
//     const newUser = {
//         email: req.body.email,
//         password: req.body.password,
//         confirmPassword: req.body.confirmPassword,
//         handle: req.body.handle
//     };

//     let errors = {};

//     if(isEmpty(newUser.email)){
//         errors.email = 'Email must not be empty'
//     } else if(!isEmail(newUser.email)){
//         errors.email = 'Must be a valid email address'
//     }

//     if(isEmpty(newUser.password)) errors.password = 'Must not be empty'
//     if(newUser.password !== newUser.confirmPassword) errors.confirmPassword = 'Passwords must match'
//     if(isEmpty(newUser.handle)) errors.handle = 'Must not be empty'

//     if(Object.keys(errors).length > 0 ) return res.status(400).json(errors);

//     // TODO: validate date
//     let token, userId;
//     db.doc(`/users/${newUser.handle}`).get()
//     .then(doc => {
//         if(doc.exists){
//             return res.status(400).json({ handle: 'this handle is already taken'});
//         }
//         else {
//             return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password)        
//         }
//     })
//     .then(data => {
//         userId = data.user.uid;
//         return data.user.getIdToken();

//     })
//     .then(idToken => {
//         token = idToken;
//         const userCredentials = {
//             handle: newUser.handle,
//             email: newUser.email,
//             createdAt: new Date().toISOString(),
//             userId
//         };
//         return db.doc(`/users/${newUser.handle}`).set(userCredentials);
//     })
//     .then(() => {
//         return res.status(201).json({ token });
//     })
//     .catch(err => {
//         console.error(err);
//         if(err.code === 'auth/email-already-in-use'){
//             return res.status(400).json({ email: 'Email is already used'})
//         }
//         return res.status(500).json({ error: err.code });
//     })
// });


// Login route
// app.post('/login', (req, res) => {
//     const user = {
//         email: req.body.email,
//         password: req.body.password
//     };

//     let errors = {};

//     if(isEmpty(user.email)) errors.email = 'Must not be empty'
//     if(isEmpty(user.password)) errors.password = 'Must not be empty'

//     if(Object.keys(errors).length > 0 ) return res.status(400).json(errors);

//     firebase.auth().signInWithEmailAndPassword(user.email, user.password)
//     .then(data => {
//         return data.user.getIdToken();
//     })
//     .then(token => {
//         return res.json({token});
//     })
//     .catch(err => {
//         console.error(err);
//         if(err.code === 'auth/wrong-password'){
//             return res.status(403).json({ general: 'Wrong credentials, please try again'});
//         }
//         else if(err.code === 'auth/user-not-found'){
//             return res.status(403).json({ general: 'User not found'});
//         }
//         else if(err.code === 'auth/invalid-email'){
//             return res.status(403).json({ general: 'Invalid email address'});
//         }
//         else return res.status(500).json({ error: err.code});
//     })
// })





// https://baseurl.com/api/

// exports.api = functions.region('europe-west1').https.onRequest(app);



