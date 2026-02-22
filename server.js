const express = require("express");
const cors = require("cors");
const oracledb = require("oracledb");

oracledb.initOracleClient({ libDir: "C:\\Oracle\\instantclient_21_20" });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));


const dbConfig = {
  user: "movie",
  password: "movie123",
  connectString: "localhost:1521/XE", // since you connect @XE in SQL*Plus
};

app.get("/", (req, res) => res.send("Movie Booking API running"));

app.get("/shows", async (req, res) => {
  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);

    const result = await conn.execute(
      `SELECT sh.show_id,
              m.title,
              sh.screen_id,
              TO_CHAR(sh.show_datetime,'YYYY-MM-DD HH24:MI') AS show_time,
              sh.price,
              sh.status
       FROM shows sh
       JOIN movies m ON m.movie_id = sh.movie_id
       ORDER BY sh.show_id`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    if (conn) await conn.close();
  }
});
app.get("/shows/:showId/available-seats", async (req, res) => {
  const showId = Number(req.params.showId);
  let conn;

  try {
    conn = await oracledb.getConnection(dbConfig);

    const showRes = await conn.execute(
      `SELECT screen_id FROM shows WHERE show_id = :id`,
      { id: showId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (showRes.rows.length === 0) {
      return res.status(404).json({ error: "Show not found" });
    }

    const screenId = showRes.rows[0].SCREEN_ID;

    const seatsRes = await conn.execute(
      `SELECT s.seat_id, s.seat_row, s.seat_no, s.seat_type
       FROM seats s
       WHERE s.screen_id = :screenId
         AND s.seat_id NOT IN (
           SELECT bs.seat_id
           FROM booking_seats bs
           WHERE bs.show_id = :showId
         )
       ORDER BY s.seat_row, s.seat_no`,
      { screenId, showId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(seatsRes.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    if (conn) await conn.close();
  }
});

app.post("/bookings", async (req, res) => {
  const { userId, showId, seatIdsCsv } = req.body;
  let conn;

  try {
    conn = await oracledb.getConnection(dbConfig);

    const result = await conn.execute(
      `BEGIN sp_create_booking(:p_user_id, :p_show_id, :p_seat_ids, :o_booking_id); END;`,
      {
        p_user_id: userId,
        p_show_id: showId,
        p_seat_ids: seatIdsCsv,
        o_booking_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    );

    await conn.commit();
    res.json({ bookingId: result.outBinds.o_booking_id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    if (conn) await conn.close();
  }
});

app.post("/payments", async (req, res) => {
  const { bookingId, method } = req.body;
  let conn;

  try {
    conn = await oracledb.getConnection(dbConfig);

    await conn.execute(
      `BEGIN sp_make_payment(:bId, :m, 'SUCCESS'); END;`,
      { bId: bookingId, m: method }
    );

    await conn.commit();
    res.json({ message: "Payment success" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    if (conn) await conn.close();
  }
});

app.get("/bookings/:id", async (req, res) => {
  const bookingId = Number(req.params.id);
  let conn;

  try {
    conn = await oracledb.getConnection(dbConfig);

    // Booking + show + movie
    const bRes = await conn.execute(
      `SELECT b.booking_id,
              b.user_id,
              b.show_id,
              b.status,
              b.total_amount,
              m.title,
              TO_CHAR(s.show_datetime,'YYYY-MM-DD HH24:MI') AS show_time,
              s.price
       FROM bookings b
       JOIN shows s ON s.show_id = b.show_id
       JOIN movies m ON m.movie_id = s.movie_id
       WHERE b.booking_id = :id`,
      { id: bookingId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (bRes.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    // Seats of that booking
    const seatRes = await conn.execute(
      `SELECT st.seat_row || st.seat_no AS seat_label, st.seat_type
       FROM booking_seats bs
       JOIN seats st ON st.seat_id = bs.seat_id
       WHERE bs.booking_id = :id
       ORDER BY st.seat_row, st.seat_no`,
      { id: bookingId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // Latest payment (if any)
    const payRes = await conn.execute(
      `SELECT method, amount, payment_status,
              TO_CHAR(paid_at,'YYYY-MM-DD HH24:MI') AS paid_at
       FROM payments
       WHERE booking_id = :id
       ORDER BY payment_id DESC`,
      { id: bookingId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      booking: bRes.rows[0],
      seats: seatRes.rows,
      payment: payRes.rows[0] || null
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    if (conn) await conn.close();
  }
});

app.listen(3000, () => console.log("API running at http://localhost:3000"));
