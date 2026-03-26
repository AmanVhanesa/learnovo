const mongoose = require('mongoose');

const knowledgeBaseArticleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  body: { type: String, required: true }, // Rich text / HTML

  category: {
    type: String,
    enum: ['getting_started', 'billing', 'features', 'troubleshooting', 'faq', 'api', 'integrations'],
    default: 'getting_started',
    index: true
  },

  tags: [{ type: String, trim: true }],
  videoUrl: { type: String, trim: true },

  isPublished: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' }
}, { timestamps: true });

knowledgeBaseArticleSchema.index({ isPublished: 1, category: 1, sortOrder: 1 });
knowledgeBaseArticleSchema.index({ title: 'text', body: 'text', tags: 'text' });

module.exports = mongoose.model('KnowledgeBaseArticle', knowledgeBaseArticleSchema);
