import app from "./app.js";

const port = Number(process.env.PORT || 5060);

app.listen(port, () => {
  console.log(`BloodDrop API listening on http://localhost:${port}`);
});
