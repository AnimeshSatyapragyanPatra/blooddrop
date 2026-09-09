import app from "./app.js";

const port = Number(process.env.PORT || 5065);

app.listen(port, () => {
  console.log(`BloodDrop API listening on http://localhost:${port}`);
});
