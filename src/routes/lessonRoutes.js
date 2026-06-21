import express from "express";
import { col } from "../db.js";
import { objectId } from "../utils/objectId.js";
import { optionalAuth, requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

const categories = ["Personal Growth", "Career", "Relationships", "Mindset", "Mistakes Learned"];
const tones = ["Motivational", "Sad", "Realization", "Gratitude"];

function calcReadingTime(text = "") {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function publicLessonProjection() {
  return {
    title: 1,
    description: 1,
    category: 1,
    emotionalTone: 1,
    image: 1,
    visibility: 1,
    accessLevel: 1,
    creatorId: 1,
    creatorName: 1,
    creatorPhoto: 1,
    likesCount: 1,
    favoritesCount: 1,
    commentsCount: 1,
    reportsCount: 1,
    isFeatured: 1,
    isReviewed: 1,
    views: 1,
    readingTime: 1,
    createdAt: 1,
    updatedAt: 1
  };
}

function canModify(req, lesson) {
  return lesson.creatorId === req.user.authId || req.user.role === "admin";
}

function serializeLesson(lesson, extra = {}) {
  return {
    ...lesson,
    _id: lesson._id.toString(),
    ...extra
  };
}

function buildSearchQuery(searchText) {
  const text = String(searchText || "").trim();

  if (!text) return {};

  return {
    $or: [
      { title: { $regex: text, $options: "i" } },
      { description: { $regex: text, $options: "i" } },
      { category: { $regex: text, $options: "i" } },
      { emotionalTone: { $regex: text, $options: "i" } }
    ]
  };
}

/* =========================
   Public lesson routes
========================= */

router.get("/public", optionalAuth, async (req, res) => {
  const lessons = await col("lessons");

  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 9), 1), 30);

  const query = {
    visibility: "Public",
    ...buildSearchQuery(req.query.search)
  };

  if (req.query.category) {
    query.category = req.query.category;
  }

  if (req.query.tone) {
    query.emotionalTone = req.query.tone;
  }

  const sort =
    req.query.sort === "most-saved"
      ? { favoritesCount: -1, createdAt: -1 }
      : { createdAt: -1 };

  const [items, total] = await Promise.all([
    lessons
      .find(query, { projection: publicLessonProjection() })
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),

    lessons.countDocuments(query)
  ]);

  const isPremium = Boolean(req.user?.isPremium);

  res.json({
    lessons: items.map((lesson) =>
      serializeLesson(lesson, {
        locked:
          lesson.accessLevel === "Premium" &&
          !isPremium &&
          lesson.creatorId !== req.user?.authId
      })
    ),
    total,
    page,
    pages: Math.ceil(total / limit),
    categories,
    tones
  });
});

router.get("/featured", optionalAuth, async (req, res) => {
  const lessons = await col("lessons");

  const list = await lessons
    .find(
      {
        visibility: "Public",
        isFeatured: true
      },
      {
        projection: publicLessonProjection()
      }
    )
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(6)
    .toArray();

  const isPremium = Boolean(req.user?.isPremium);

  res.json({
    lessons: list.map((lesson) =>
      serializeLesson(lesson, {
        locked:
          lesson.accessLevel === "Premium" &&
          !isPremium &&
          lesson.creatorId !== req.user?.authId
      })
    )
  });
});

router.get("/most-saved", async (_req, res) => {
  const lessons = await col("lessons");

  const list = await lessons
    .find(
      {
        visibility: "Public"
      },
      {
        projection: publicLessonProjection()
      }
    )
    .sort({ favoritesCount: -1, createdAt: -1 })
    .limit(6)
    .toArray();

  res.json({
    lessons: list.map((lesson) => serializeLesson(lesson))
  });
});

router.get("/top-contributors", async (_req, res) => {
  const lessons = await col("lessons");

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const contributors = await lessons
    .aggregate([
      {
        $match: {
          createdAt: { $gte: since }
        }
      },
      {
        $group: {
          _id: "$creatorId",
          name: { $first: "$creatorName" },
          photoURL: { $first: "$creatorPhoto" },
          total: { $sum: 1 }
        }
      },
      {
        $sort: { total: -1 }
      },
      {
        $limit: 6
      }
    ])
    .toArray();

  res.json({ contributors });
});

/* =========================
   User-specific routes
========================= */

router.get("/mine", requireAuth, async (req, res) => {
  const lessons = await col("lessons");

  const list = await lessons
    .find({ creatorId: req.user.authId })
    .sort({ createdAt: -1 })
    .toArray();

  res.json({
    lessons: list.map((lesson) => serializeLesson(lesson))
  });
});

router.get("/user/favorites", requireAuth, async (req, res) => {
  const favorites = await col("favorites");
  const lessons = await col("lessons");

  const saved = await favorites
    .find({ userId: req.user.authId })
    .sort({ savedAt: -1 })
    .toArray();

  const ids = saved.map((f) => objectId(f.lessonId)).filter(Boolean);

  const list = await lessons
    .find({ _id: { $in: ids } })
    .sort({ createdAt: -1 })
    .toArray();

  res.json({
    lessons: list.map((lesson) => serializeLesson(lesson))
  });
});

/* =========================
   Admin routes
   IMPORTANT: keep these before /:id routes
========================= */

router.get("/admin/all", requireAuth, requireAdmin, async (req, res) => {
  const lessons = await col("lessons");

  const filter = {};

  if (req.query.category) {
    filter.category = req.query.category;
  }

  if (req.query.visibility) {
    filter.visibility = req.query.visibility;
  }

  if (req.query.flags === "true") {
    filter.reportsCount = { $gt: 0 };
  }

  const list = await lessons.find(filter).sort({ createdAt: -1 }).toArray();

  const [publicCount, privateCount, flaggedCount, featuredCount, reviewedCount] =
    await Promise.all([
      lessons.countDocuments({ visibility: "Public" }),
      lessons.countDocuments({ visibility: "Private" }),
      lessons.countDocuments({ reportsCount: { $gt: 0 } }),
      lessons.countDocuments({ isFeatured: true }),
      lessons.countDocuments({ isReviewed: true })
    ]);

  res.json({
    lessons: list.map((lesson) => serializeLesson(lesson)),
    stats: {
      publicCount,
      privateCount,
      flaggedCount,
      featuredCount,
      reviewedCount
    }
  });
});

router.get("/admin/reports", requireAuth, requireAdmin, async (_req, res) => {
  const reports = await col("lessonsReports");

  const list = await reports
    .aggregate([
      {
        $group: {
          _id: "$lessonId",
          lessonTitle: { $first: "$lessonTitle" },
          count: { $sum: 1 },
          reasons: {
            $push: {
              reason: "$reason",
              reporterUserId: "$reporterUserId",
              reportedUserEmail: "$reportedUserEmail",
              timestamp: "$timestamp"
            }
          }
        }
      },
      {
        $sort: { count: -1 }
      }
    ])
    .toArray();

  res.json({ reports: list });
});

router.delete("/admin/reports/:lessonId", requireAuth, requireAdmin, async (req, res) => {
  const reports = await col("lessonsReports");
  const lessons = await col("lessons");

  await reports.deleteMany({
    lessonId: req.params.lessonId
  });

  const id = objectId(req.params.lessonId);

  if (id) {
    await lessons.updateOne(
      { _id: id },
      {
        $set: {
          reportsCount: 0,
          updatedAt: new Date()
        }
      }
    );
  }

  res.json({ message: "Reports ignored and cleared" });
});

/* =========================
   Create lesson
========================= */

router.post("/", requireAuth, async (req, res) => {
  const lessons = await col("lessons");
  const body = req.body;

  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();

  if (!title || !description) {
    return res.status(400).json({
      message: "Title and description are required."
    });
  }

  const accessLevel =
    req.user.isPremium && body.accessLevel === "Premium" ? "Premium" : "Free";

  const now = new Date();

  const lesson = {
    title,
    description,
    category: categories.includes(body.category) ? body.category : "Personal Growth",
    emotionalTone: tones.includes(body.emotionalTone)
      ? body.emotionalTone
      : "Motivational",
    image: body.image || "",
    visibility: body.visibility === "Private" ? "Private" : "Public",
    accessLevel,
    creatorId: req.user.authId,
    creatorEmail: req.user.email,
    creatorName: req.user.name,
    creatorPhoto: req.user.photoURL || req.user.image || "",
    likes: [],
    likesCount: 0,
    favoritesCount: 0,
    commentsCount: 0,
    reportsCount: 0,
    isFeatured: false,
    isReviewed: false,
    views: Math.floor(Math.random() * 10000),
    readingTime: calcReadingTime(description),
    createdAt: now,
    updatedAt: now
  };

  const result = await lessons.insertOne(lesson);

  res.status(201).json({
    message: "Lesson created successfully",
    lesson: serializeLesson({ ...lesson, _id: result.insertedId })
  });
});

/* =========================
   Single lesson details
========================= */

router.get("/:id", requireAuth, async (req, res) => {
  const lessons = await col("lessons");
  const commentsCol = await col("comments");

  const id = objectId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "Invalid lesson id" });
  }

  const lesson = await lessons.findOne({ _id: id });

  if (!lesson) {
    return res.status(404).json({ message: "Lesson not found" });
  }

  const ownerOrAdmin = canModify(req, lesson);

  const locked =
    lesson.accessLevel === "Premium" &&
    !req.user.isPremium &&
    !ownerOrAdmin;

  await lessons.updateOne(
    { _id: id },
    {
      $inc: { views: 1 }
    }
  );

  const comments = await commentsCol
    .find({ lessonId: req.params.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  // ✅ New: count total lessons created by this author
  const totalLessonsCreated = await lessons.countDocuments({
    creatorId: lesson.creatorId
  });

  let similar = [];

  if (!locked) {
    similar = await lessons
      .find(
        {
          _id: { $ne: id },
          visibility: "Public",
          $or: [
            { category: lesson.category },
            { emotionalTone: lesson.emotionalTone }
          ]
        },
        {
          projection: publicLessonProjection()
        }
      )
      .limit(6)
      .toArray();
  }

  res.json({
    lesson: serializeLesson(lesson, {
      locked,
      isLiked: lesson.likes?.includes(req.user.authId),
      isOwner: ownerOrAdmin,

      // ✅ New fields for Author / Creator section
      authorTotalLessons: totalLessonsCreated,
      author: {
        id: lesson.creatorId,
        name: lesson.creatorName,
        email: lesson.creatorEmail,
        photo: lesson.creatorPhoto,
        totalLessonsCreated
      }
    }),
    comments: comments.map((c) => serializeLesson(c)),
    similar: similar.map((s) => serializeLesson(s))
  });
});

/* =========================
   Update lesson
========================= */

router.put("/:id", requireAuth, async (req, res) => {
  const lessons = await col("lessons");
  const id = objectId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "Invalid lesson id" });
  }

  const lesson = await lessons.findOne({ _id: id });

  if (!lesson) {
    return res.status(404).json({ message: "Lesson not found" });
  }

  if (!canModify(req, lesson)) {
    return res.status(403).json({
      message: "Only owner or admin can update this lesson"
    });
  }

  const nextDescription = req.body.description ?? lesson.description;

  const patch = {
    title: req.body.title ?? lesson.title,
    description: nextDescription,
    category: categories.includes(req.body.category) ? req.body.category : lesson.category,
    emotionalTone: tones.includes(req.body.emotionalTone)
      ? req.body.emotionalTone
      : lesson.emotionalTone,
    image: req.body.image ?? lesson.image,
    visibility: req.body.visibility === "Private" ? "Private" : "Public",
    accessLevel:
      req.user.isPremium && req.body.accessLevel === "Premium"
        ? "Premium"
        : "Free",
    readingTime: calcReadingTime(nextDescription),
    updatedAt: new Date()
  };

  await lessons.updateOne({ _id: id }, { $set: patch });

  res.json({ message: "Lesson updated successfully" });
});

/* =========================
   Update lesson settings
========================= */

router.patch("/:id/settings", requireAuth, async (req, res) => {
  const lessons = await col("lessons");
  const id = objectId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "Invalid lesson id" });
  }

  const lesson = await lessons.findOne({ _id: id });

  if (!lesson) {
    return res.status(404).json({ message: "Lesson not found" });
  }

  if (!canModify(req, lesson)) {
    return res.status(403).json({ message: "Not allowed" });
  }

  const patch = {
    updatedAt: new Date()
  };

  if (req.body.visibility) {
    patch.visibility = req.body.visibility === "Private" ? "Private" : "Public";
  }

  if (req.body.accessLevel) {
    patch.accessLevel =
      req.user.isPremium && req.body.accessLevel === "Premium"
        ? "Premium"
        : "Free";
  }

  if (req.user.role === "admin") {
    if (req.body.isFeatured !== undefined) {
      patch.isFeatured = Boolean(req.body.isFeatured);

      if (patch.isFeatured) {
        patch.visibility = "Public";
      }
    }

    if (req.body.isReviewed !== undefined) {
      patch.isReviewed = Boolean(req.body.isReviewed);
    }
  }

  await lessons.updateOne({ _id: id }, { $set: patch });

  const updatedLesson = await lessons.findOne({ _id: id });

  res.json({
    message: "Lesson settings updated",
    patch,
    lesson: serializeLesson(updatedLesson)
  });
});

/* =========================
   Delete lesson
========================= */

router.delete("/:id", requireAuth, async (req, res) => {
  const lessons = await col("lessons");
  const favorites = await col("favorites");
  const comments = await col("comments");
  const reports = await col("lessonsReports");

  const id = objectId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "Invalid lesson id" });
  }

  const lesson = await lessons.findOne({ _id: id });

  if (!lesson) {
    return res.status(404).json({ message: "Lesson not found" });
  }

  if (!canModify(req, lesson)) {
    return res.status(403).json({
      message: "Only owner or admin can delete this lesson"
    });
  }

  await Promise.all([
    lessons.deleteOne({ _id: id }),
    favorites.deleteMany({ lessonId: req.params.id }),
    comments.deleteMany({ lessonId: req.params.id }),
    reports.deleteMany({ lessonId: req.params.id })
  ]);

  res.json({ message: "Lesson deleted" });
});

/* =========================
   Engagement routes
========================= */

router.post("/:id/like", requireAuth, async (req, res) => {
  const lessons = await col("lessons");
  const id = objectId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "Invalid lesson id" });
  }

  const lesson = await lessons.findOne({ _id: id });

  if (!lesson) {
    return res.status(404).json({ message: "Lesson not found" });
  }

  const liked = lesson.likes?.includes(req.user.authId);

  await lessons.updateOne(
    { _id: id },
    liked
      ? {
        $pull: { likes: req.user.authId },
        $inc: { likesCount: -1 }
      }
      : {
        $addToSet: { likes: req.user.authId },
        $inc: { likesCount: 1 }
      }
  );

  const updated = await lessons.findOne(
    { _id: id },
    {
      projection: {
        likesCount: 1,
        likes: 1
      }
    }
  );

  res.json({
    liked: !liked,
    likesCount: updated.likesCount || 0
  });
});

router.post("/:id/favorite", requireAuth, async (req, res) => {
  const favorites = await col("favorites");
  const lessons = await col("lessons");

  const id = objectId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "Invalid lesson id" });
  }

  const lesson = await lessons.findOne({ _id: id });

  if (!lesson) {
    return res.status(404).json({ message: "Lesson not found" });
  }

  const existing = await favorites.findOne({
    userId: req.user.authId,
    lessonId: req.params.id
  });

  if (existing) {
    await favorites.deleteOne({ _id: existing._id });
    await lessons.updateOne(
      { _id: id },
      {
        $inc: { favoritesCount: -1 }
      }
    );

    return res.json({
      saved: false,
      message: "Removed from favorites"
    });
  }

  await favorites.insertOne({
    userId: req.user.authId,
    lessonId: req.params.id,
    savedAt: new Date()
  });

  await lessons.updateOne(
    { _id: id },
    {
      $inc: { favoritesCount: 1 }
    }
  );

  res.json({
    saved: true,
    message: "Saved to favorites"
  });
});

router.post("/:id/comments", requireAuth, async (req, res) => {
  const text = String(req.body.text || "").trim();

  if (!text) {
    return res.status(400).json({
      message: "Comment text is required"
    });
  }

  const lessons = await col("lessons");
  const comments = await col("comments");

  const id = objectId(req.params.id);

  if (!id || !(await lessons.findOne({ _id: id }))) {
    return res.status(404).json({ message: "Lesson not found" });
  }

  const comment = {
    lessonId: req.params.id,
    userId: req.user.authId,
    userName: req.user.name,
    userPhoto: req.user.photoURL || req.user.image || "",
    text,
    createdAt: new Date()
  };

  const result = await comments.insertOne(comment);

  await lessons.updateOne(
    { _id: id },
    {
      $inc: { commentsCount: 1 }
    }
  );

  res.status(201).json({
    message: "Comment posted",
    comment: serializeLesson({ ...comment, _id: result.insertedId })
  });
});

router.post("/:id/report", requireAuth, async (req, res) => {
  const reason = String(req.body.reason || "Other").trim();
  const lessons = await col("lessons");
  const reports = await col("lessonsReports");

  const id = objectId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "Invalid lesson id" });
  }

  const lesson = await lessons.findOne({ _id: id });

  if (!lesson) {
    return res.status(404).json({ message: "Lesson not found" });
  }

  await reports.updateOne(
    {
      lessonId: req.params.id,
      reporterUserId: req.user.authId
    },
    {
      $set: {
        lessonId: req.params.id,
        lessonTitle: lesson.title,
        reporterUserId: req.user.authId,
        reportedUserEmail: lesson.creatorEmail,
        reason,
        timestamp: new Date()
      }
    },
    {
      upsert: true
    }
  );

  const reportsCount = await reports.countDocuments({
    lessonId: req.params.id
  });

  await lessons.updateOne(
    { _id: id },
    {
      $set: {
        reportsCount,
        updatedAt: new Date()
      }
    }
  );

  res.json({ message: "Report submitted" });
});

export default router;