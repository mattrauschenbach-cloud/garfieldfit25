import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

export default function AllTimeLeaders() {
  const [members, setMembers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // 🔒 listen for auth state and enable editing for your email
    const unsub = auth.onAuthStateChanged((user) => {
      setIsAdmin(user?.email === "mattrauschenbach@gmail.com");
    });

    const fetchMembers = async () => {
      const snapshot = await getDocs(collection(db, "members"));
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMembers(list);
    };
    fetchMembers();

    return () => unsub();
  }, []);

  const handleChange = (id, field, value) => {
    setMembers(prev =>
      prev.map(m => (m.id === id ? { ...m, [field]: Number(value) || 0 } : m))
    );
  };

  const saveChanges = async (id, data) => {
    await updateDoc(doc(db, "members", id), {
      firsts: data.firsts || 0,
      seconds: data.seconds || 0,
      thirds: data.thirds || 0,
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">🏁 All-Time Leaderboard</h1>

      <Card className="shadow-md rounded-2xl border">
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between text-sm font-semibold text-gray-600 border-b pb-2">
            <span>Name</span>
            <div className="flex gap-4">
              <span>🥇 1st</span>
              <span>🥈 2nd</span>
              <span>🥉 3rd</span>
            </div>
          </div>

          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between border-b pb-2 last:border-none">
              <span className="font-medium">{m.name}</span>
              <div className="flex gap-3 items-center">
                {isAdmin ? (
                  <>
                    <Input type="number" value={m.firsts || 0}
                      onChange={e => handleChange(m.id, "firsts", e.target.value)}
                      className="w-14 text-center" />
                    <Input type="number" value={m.seconds || 0}
                      onChange={e => handleChange(m.id, "seconds", e.target.value)}
                      className="w-14 text-center" />
                    <Input type="number" value={m.thirds || 0}
                      onChange={e => handleChange(m.id, "thirds", e.target.value)}
                      className="w-14 text-center" />
                    <Button size="sm" variant="outline" onClick={() => saveChanges(m.id, m)}>
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="w-8 text-center">{m.firsts || 0}</span>
                    <span className="w-8 text-center">{m.seconds || 0}</span>
                    <span className="w-8 text-center">{m.thirds || 0}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
