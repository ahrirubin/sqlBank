import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

const app = express();
const port = 3001;


app.use(cors());
app.use(bodyParser.json());


const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "bank",
  port: 3306,
});

function generateOTP() {
  const otp = Math.floor(100000 + Math.random() * 900000);
  return otp.toString();
}



async function query(sql, params) {
  const [results] = await pool.execute(sql, params);
  return results;
}


app.post("/users", async (req, res) => {
  const { username, password } = req.body;

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  console.log("hashedPassword", hashedPassword);

  try {
    
    const result = await query(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword]
    );

    const id = result.insertId; 
    const newUser = { id, username, password };
    users.push(newUser);

    console.log(newUser);

    const accountId = accounts.length + 1;
    const newAccount = { id: accountId, userId: id, amount: 0 };
    accounts.push(newAccount);

    console.log(newAccount);

    res.status(201).json({
      success: true,
      message: "Användare och konto skapade framgångsrikt.",
    });
  } catch (error) {
    console.error("error creating user:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

app.post("/sessions", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);

    if (result.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Ogiltiga inloggningsuppgifter." });
    }

    const user = result[0];

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Ogiltiga inloggningsuppgifter." });
    }

    const token = generateOTP();
    sessions.push({ userId: user.id, token });

    res.json({ success: true, token });

    console.log(sessions);
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({
      success: false,
      message: "Ett fel inträffade under inloggningen.",
    });
  }
});


app.put("/new-password", async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;

  const result = await query("SELECT * FROM users WHERE username = ?", [
    username,
  ]);
  const user = result[0];

  const passwordMatch = await bcrypt.compare(oldPassword, user.password);

  if (!passwordMatch) {
    return res.status(401).json({ success: false, message: "Ogiltigt" });
  }

  const saltRounds = 10;
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

  try {
    const updateResult = await query(
      "UPDATE users SET password = ? WHERE id = ?",
      [hashedNewPassword, user.id]
    );
    res.status(204).send("User updated");
  } catch (error) {
    res.status(500).send("Error updating user");
  }
});

app.delete("/users", async (req, res) => {
  const { username } = req.body;

  try {
    const deleteResult = await query("DELETE FROM users WHERE username = ?", [
      username,
    ]);
    console.log("deleteResult", deleteResult);
    res.send("user deleted");
  } catch (error) {
    res.status(500).send("Error deleting user");
  }
});


app.post("/me/accounts", (req, res) => {
  const { token } = req.body;

  console.log("token", token); 

  const session = sessions.find((session) => session.token === token);

  if (!session) {
    return res
      .status(401)
      .json({ success: false, message: "Ogiltig sessions token." });
  }

  const userId = session.userId;
  const account = accounts.find((account) => account.userId === userId);

  if (!account) {
    return res
      .status(404)
      .json({ success: false, message: "Konto hittades inte för användaren." });
  }

  res.json({ success: true, amount: account.amount });
  console.log(account);
});

app.post("/me/accounts/transactions", (req, res) => {
  const { token, amount, otp } = req.body;

  const session = sessions.find((session) => session.token === token);

  if (!session) {
    return res
      .status(401)
      .json({ success: false, message: "Ogiltig sessions token." });
  }

  const userId = session.userId;
  const user = users.find((user) => user.id === userId);

  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: "Ogiltiga autentiseringsuppgifter." });
  }

  const account = accounts.find((account) => account.userId === userId);

  if (!account) {
    return res
      .status(404)
      .json({ success: false, message: "Konto hittades inte för användaren." });
  }

  // Kontrollera om det angivna engångslösenordet matchar det sparade för användaren
  const sessionWithOTP = sessions.find(
    (session) => session.token === token && session.otp === otp
  );

  if (!sessionWithOTP) {
    return res
      .status(401)
      .json({ success: false, message: "Felaktigt engångslösenord." });
  }

  // Lägg till det insatta beloppet till saldot
  account.amount += parseFloat(amount);

  res.json({ success: true, newBalance: account.amount });
});

// Starta servern
app.listen(port, () => {
  console.log(`Bankens backend körs på port:${port}`);
});