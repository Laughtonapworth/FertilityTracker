// firebase-config.js
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>

<script>
  const firebaseConfig = {
    apiKey: "AIzaSyByvnVx2aZEldUfqS2c6VNC6UJRIOPvGws",
    authDomain: "fertility-tracker-c35ff.firebaseapp.com",
    projectId: "fertility-tracker-c35ff",
    storageBucket: "fertility-tracker-c35ff.appspot.com",
    messagingSenderId: "775022478214",
    appId: "1:775022478214:web:107ba4f9e0043bee75a207"
  };

  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth();
</script>

