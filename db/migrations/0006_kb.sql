-- Help-centre passages for the NETS Assistant. Shared content, NOT merchant data: no merchant_id.
-- Seeded from content/faq.md by `npm run seed`. Full-text search for the MVP (embeddings are Phase 2).

CREATE TABLE kb_chunks (
  id      INT          NOT NULL AUTO_INCREMENT,
  source  VARCHAR(80)  NOT NULL COMMENT 'topic group, e.g. Settlements',
  heading VARCHAR(200) NOT NULL COMMENT 'the question',
  content TEXT         NOT NULL COMMENT 'the answer',
  PRIMARY KEY (id),
  FULLTEXT KEY ft_kb_chunks (heading, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
