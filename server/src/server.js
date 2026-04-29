const app = require('./app')

// ✅ CRITICAL FIX FOR RENDER
const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})