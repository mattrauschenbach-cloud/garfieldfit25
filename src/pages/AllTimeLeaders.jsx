import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";

export default function AllTimeLeaders() {
  const [members, setMembers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setIsAdmin(user?.email === "mattrauschenbach@gmail.com");
    });

    const fetchMembers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "members"));
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const sorted = list
          .map((m) => ({
            ...m,
            firsts: m.firsts || 0,
            seconds: m.seconds || 0,
            thirds: m.thirds || 0,
            total: (m.firsts || 0) * 3 + (m.seconds || 0) * 2 + (m.thirds || 0),
          }))
          .sort((a, b) => b.total - a.total);
        setMembers(sorted);
      } catch (err) {
        console.error("Error fetching members:", err);
      }
    };

    fetchMembers();
    return () => unsub();
  }, []);

  const handleChange = (id, field, value) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, [field]: Number(value) || 0 } : m
      )
    );
  };

  const saveChanges = async (id, data) => {
    try {
      await updateDoc(doc(db, "members", id), {
        firsts: data.firsts || 0,
        seconds: data.seconds || 0,
        thirds: data.thirds || 0,
      });
    } catch (err) {
      console.error("Error saving changes:", err);
    }
  };

  // Auto resort whenever numbers change
  useEffect(() => {
    setMembers((prev) =>
      [...prev]
        .map((m) => ({
          ...m,
          total: (m.firsts || 0) * 3 + (m.seconds || 0) * 2 + (m.thirds || 0),
        }))
        .sort((a, b) => b.total - a.total)
    );
  }, [members.length]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">
        🏁 All-Time Leaderboard
      </h1>

      {/* Leaderboard container */}
      <div className="bg-[#0f172a] border border-gray-700 rounded-2xl shadow-lg p-4">
        <div className="grid grid-cols-6 text-sm font-semibold text-gray-300 border-b border-gray-700 pb-2">
          <span>#</span>
          <span>Name</span>
          <span className="text-center">🥇</span>
          <span className="text-center">🥈</span>
          <span className="text-center">🥉</span>
          <span className="text-center">Points</span>
        </div>

        {members.map((m, i) => (
          <div
            key={m.id}
            className="grid grid-cols-6 items-center border-b border-gray-700 py-2 last:border-none text-gray-100"
          >
            <span className="text-gray-400 font-semibold">{i + 1}</span>
            <span className="font-medium flex items-center gap-1">
              {i === 0 && "🥇"}
              {i === 1 && "🥈"}
              {i === 2 && "🥉"}
              {m.name}
            </span>

            {isAdmin ? (
              <>
                <input
                  type="number"
                  value={m.firsts || 0}
                  onChange={(e) =>
                    handleChange(m.id, "firsts", e.target.value)
                  }
                  className="w-14 mx-auto text-center bg-gray-800 border border-gray-600 rounded-md p-1"
                />
                <input
                  type="number"
                  value={m.seconds || 0}
                  onChange={(e) =>
                    handleChange(m.id, "seconds", e.target.value)
                  }
                  className="w-14 mx-auto text-center bg-gray-800 border border-gray-600 rounded-md p-1"
                />
                <input
                  type="number"
                  value={m.thirds || 0}
                  onChange={(e) =>
                    handleChange(m.id, "thirds", e.target.value)
                  }
                  className="w-14 mx-auto text-center bg-gray-800 border border-gray-600 rounded-md p-1"
                />
              </>
            ) : (
              <>
                <span className="text-center">{m.firsts || 0}</span>
                <span className="text-center">{m.seconds || 0}</span>
                <span className="text-center">{m.thirds || 0}</span>
              </>
            )}

            <span className="text-center font-semibold text-yellow-400">
              {m.total || 0}
            </span>

            {isAdmin && (
              <button
                onClick={() => saveChanges(m.id, m)}
                className="col-span-6 mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-sm rounded-md text-white mx-auto"
              >
                Save
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="text-center mt-6 text-sm text-gray-500">
        Points = 🥇×3 + 🥈×2 + 🥉×1 — auto-ranked
      </div>
    </div>
  );
}
