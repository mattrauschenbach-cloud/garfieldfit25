import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase"; // ✅ correct path
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

export default function AllTimeLeaders() {
  const [members, setMembers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Only allow editing for Matt
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
        // ✅ Add total points & sort automatically
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

  // ✅ Re-sort automatically when data changes (after edit)
  useEffect(() => {
    setMembers((prev) =>
      [...prev]
        .map((m) => ({
          ...m,
          total: (m.firsts || 0) * 3 + (m.seconds || 0) * 2 + (m.thirds || 0),
        }))
        .sort((a, b) => b.total - a.total)
    );
  }, [members.length]); // run when member list updates

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">
        🏁 All-Time Leaderboard
      </h1>

      <Card className="shadow-md rounded-2xl border">
        <CardContent className="p-4 space-y-3">
          {/* Header row */}
          <div className="grid grid-cols-5 text-sm font-semibold text-gray-600 border-b pb-2">
            <span>#</span>
            <span>Name</span>
            <span className="text-center">🥇 1st</span>
            <span className="text-center">🥈 2nd</span>
            <span className="text-center">🥉 3rd</span>
          </div>

          {/* Members list */}
          {members.map((m, i) => (
            <div
              key={m.id}
              className="grid grid-cols-5 items-center border-b py-2 last:border-none"
            >
              <span className="font-semibold text-gray-400">{i + 1}</span>
              <div className="font-medium flex items-center gap-1">
                {i === 0 && "🥇"}
                {i === 1 && "🥈"}
                {i === 2 && "🥉"}
                {m.name}
              </div>

              {/* Editable / read-only columns */}
              {isAdmin ? (
                <>
                  <Input
                    type="number"
                    value={m.firsts || 0}
                    onChange={(e) =>
                      handleChange(m.id, "firsts", e.target.value)
                    }
                    className="w-14 mx-auto text-center"
                  />
                  <Input
                    type="number"
                    value={m.seconds || 0}
                    onChange={(e) =>
                      handleChange(m.id, "seconds", e.target.value)
                    }
                    className="w-14 mx-auto text-center"
                  />
                  <Input
                    type="number"
                    value={m.thirds || 0}
                    onChange={(e) =>
                      handleChange(m.id, "thirds", e.target.value)
                    }
                    className="w-14 mx-auto text-center"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="col-span-5 mt-2 w-fit mx-auto"
                    onClick={() => saveChanges(m.id, m)}
                  >
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-center">{m.firsts || 0}</span>
                  <span className="text-center">{m.seconds || 0}</span>
                  <span className="text-center">{m.thirds || 0}</span>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ✅ Totals footer */}
      <div className="text-center mt-6 text-sm text-gray-500">
        Points = 🥇×3 + 🥈×2 + 🥉×1 — sorted automatically
      </div>
    </div>
  );
}
