// Template para integração com Firebase (opcional)
// - Instale: npm install firebase
// - Crie um projeto no Firebase e substitua as config abaixo

/*
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

export async function saveTransactionToFirestore(tx){
  const col = collection(db, 'transactions')
  await addDoc(col, tx)
}

export async function loadTransactionsFromFirestore(){
  const col = collection(db, 'transactions')
  const snap = await getDocs(col)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
*/

// Template para usar Firebase (Firestore) - NÃO inclua chaves públicas em repositórios públicos.
// Passos:
// 1) npm install firebase
// 2) crie um projeto no Firebase e copie a firebaseConfig
// 3) importe este arquivo ou copie as funções desejadas para seu projeto de build

/*
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

export async function saveTransaction(tx){
  // if tx.id exists, use setDoc to keep id consistent
  if(tx.id){
    await setDoc(doc(db, 'transactions', tx.id), tx)
    return tx
  }
  const ref = await addDoc(collection(db, 'transactions'), tx)
  return { ...tx, id: ref.id }
}

export async function deleteTransaction(id){
  await deleteDoc(doc(db, 'transactions', id))
}

export async function loadTransactions(){
  const snap = await getDocs(collection(db, 'transactions'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
*/

// For the static/demo usage in index.html, we expose a no-op implementation that can be replaced
window.FirebaseAPI = window.FirebaseAPI || {}
window.FirebaseAPI.saveTransaction = window.FirebaseAPI.saveTransaction || (async (tx)=>{ console.log('Firebase save placeholder', tx); return tx })
window.FirebaseAPI.deleteTransaction = window.FirebaseAPI.deleteTransaction || (async (id)=>{ console.log('Firebase delete placeholder', id) })
window.FirebaseAPI.loadTransactions = window.FirebaseAPI.loadTransactions || (async ()=>{ console.log('Firebase load placeholder'); return [] })

console.log('Abra este arquivo e siga as instruções para usar o Firebase. Exponha as funções reais em window.FirebaseAPI para sincronização.')

// Auth placeholders
window.FirebaseAPI.auth = window.FirebaseAPI.auth || {}
window.FirebaseAPI.auth.login = window.FirebaseAPI.auth.login || (async (email,password)=>{ console.log('auth login placeholder', email); return { uid: 'local', email } })
window.FirebaseAPI.auth.register = window.FirebaseAPI.auth.register || (async (email,password)=>{ console.log('auth register placeholder', email); return { uid: 'local', email } })
window.FirebaseAPI.auth.logout = window.FirebaseAPI.auth.logout || (async ()=>{ console.log('auth logout placeholder') })
window.FirebaseAPI.auth.getCurrentUser = window.FirebaseAPI.auth.getCurrentUser || (async ()=> null)
