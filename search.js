async function searchUserEngagements(db, userId) {
  const profile = {
    userId,
    communities: [],
    courses: [],
    telemedicineRooms: [],
    funds: [],
    initiatives: [],
    artProjects: []
  };

  return new Promise((resolve, reject) => {
    // We execute queries sequentially to build the cross-referenced profile

    // 1. Communities
    db.all(`
      SELECT c.id, c.name
      FROM community_members cm
      JOIN communities c ON cm.communityId = c.id
      WHERE cm.userId = ?
    `, [userId], (err, rows) => {
      if (err) return reject(err);
      profile.communities = rows;

      // 2. Courses
      db.all(`
        SELECT c.id, c.title, c.targetCommunityId
        FROM enrollments e
        JOIN courses c ON e.courseId = c.id
        WHERE e.userId = ?
      `, [userId], (err, rows) => {
        if (err) return reject(err);
        profile.courses = rows;

        // 3. Telemedicine Rooms
        db.all(`
          SELECT tr.id, tr.communityId
          FROM room_participants rp
          JOIN telemedicineRooms tr ON rp.roomId = tr.id
          WHERE rp.userId = ?
        `, [userId], (err, rows) => {
          if (err) return reject(err);
          profile.telemedicineRooms = rows;

          // 4. Funds
          db.all(`
            SELECT f.id, f.balance, f.communityId
            FROM fund_members fm
            JOIN funds f ON fm.fundId = f.id
            WHERE fm.userId = ?
          `, [userId], (err, rows) => {
            if (err) return reject(err);
            profile.funds = rows;

            // 5. Initiatives
            db.all(`
              SELECT i.id, i.title, i.communityId
              FROM volunteers v
              JOIN initiatives i ON v.initiativeId = i.id
              WHERE v.userId = ?
            `, [userId], (err, rows) => {
              if (err) return reject(err);
              profile.initiatives = rows;

              // 6. Art Projects
              db.all(`
                SELECT ap.id, ap.title, ap.communityId
                FROM collaborators c
                JOIN artProjects ap ON c.projectId = ap.id
                WHERE c.userId = ?
              `, [userId], (err, rows) => {
                if (err) return reject(err);
                profile.artProjects = rows;

                resolve(profile);
              });
            });
          });
        });
      });
    });
  });
}

module.exports = {
  searchUserEngagements
};