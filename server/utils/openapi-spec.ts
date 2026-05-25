// OpenAPI 3.1 spec for ThreatNoir public API.
// Kept as a TypeScript object (not raw JSON) so it can be type-checked and co-located with code.

export const openapiSpec = {
  openapi: '3.1.0',
  jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
  info: {
    title: 'ThreatNoir API',
    description:
      'Curated cybersecurity threat intelligence — IOCs, articles, weekly roundups, focus items, and awareness lessons.',
    version: '1.0.0',
    contact: { url: 'https://threatnoir.com/developer' }
  },
  servers: [{ url: 'https://threatnoir.com', description: 'Production' }],
  security: [],
  tags: [
    { name: 'Articles' },
    { name: 'IOCs' },
    { name: 'Weekly' },
    { name: 'Focus' },
    { name: 'Awareness' },
    { name: 'Notifications' },
    { name: 'Submit' }
  ],
  paths: {
    '/api/v1/articles': {
      get: {
        tags: ['Articles'],
        operationId: 'listArticles',
        summary: 'List approved articles',
        description:
          'Returns approved articles with optional full-text search and filters. Results are paginated via offset/limit.',
        'x-rateLimit': { key: 'ip', limit: 30, windowMs: 60000 },
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Page size. Default 20. Min 1, max 50.',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
          },
          {
            name: 'offset',
            in: 'query',
            required: false,
            description: 'Result offset for pagination. Default 0.',
            schema: { type: 'integer', minimum: 0, default: 0 }
          },
          {
            name: 'category',
            in: 'query',
            required: false,
            description: 'Filter by category slug (lowercase letters, numbers, hyphens).',
            schema: { type: 'string', pattern: '^[a-z0-9-]+$' }
          },
          {
            name: 'tag',
            in: 'query',
            required: false,
            description: 'Filter by tag slug (lowercase letters, numbers, hyphens).',
            schema: { type: 'string', pattern: '^[a-z0-9-]+$' }
          },
          {
            name: 'q',
            in: 'query',
            required: false,
            description: 'Search query (max 200 chars). HTML is stripped server-side.',
            schema: { type: 'string', minLength: 1, maxLength: 200 }
          }
        ],
        responses: {
          '200': {
            description: 'A page of approved articles.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ArticlesResponse' }
              }
            }
          },
          '400': {
            description: 'Invalid query parameters.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '401': {
            description: 'Unauthorized (not expected for this endpoint).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '429': {
            description: 'Too many requests.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/v1/iocs': {
      get: {
        tags: ['IOCs'],
        operationId: 'listIocs',
        summary: 'List or search IOCs (indicators of compromise)',
        description:
          'Lists recent IOCs or searches by value substring. Sending a valid Bearer API key increases search rate limits and max results. If a Bearer key is sent but invalid/revoked, the request returns 401.',
        // Optional auth: include {} to indicate no auth is also allowed.
        security: [{}, { bearerAuth: [] }],
        'x-rateLimit': {
          tiers: [
            { when: 'list (no q)', key: 'ip', limit: 30, windowMs: 60000 },
            { when: 'search with Bearer key', key: 'apiKeyId', limit: 100, windowMs: 60000 },
            { when: 'search without key', key: 'ip', limit: 10, windowMs: 3600000 }
          ]
        },
        parameters: [
          {
            name: 'type',
            in: 'query',
            required: false,
            description: 'Filter by IOC type.',
            schema: {
              type: 'string',
              enum: [
                'ip',
                'domain',
                'hash_md5',
                'hash_sha1',
                'hash_sha256',
                'url',
                'cve',
                'mitre_attack',
                'email',
                'malware'
              ]
            }
          },
          {
            name: 'q',
            in: 'query',
            required: false,
            description: 'Search substring (max 200 chars). HTML is stripped server-side.',
            schema: { type: 'string', minLength: 1, maxLength: 200 }
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description:
              'Page size. If q is provided and request is unauthenticated, max 10; otherwise max 50.',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 50 }
          },
          {
            name: 'offset',
            in: 'query',
            required: false,
            description: 'Result offset for pagination. Default 0.',
            schema: { type: 'integer', minimum: 0, default: 0 }
          }
        ],
        responses: {
          '200': {
            description: 'A page of IOCs.',
            headers: {
              'X-RateLimit-Limit': {
                description: 'Maximum requests allowed for the current rate-limit tier.',
                schema: { type: 'integer' }
              },
              'X-RateLimit-Remaining': {
                description: 'Remaining requests in the current window.',
                schema: { type: 'integer' }
              }
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IocsResponse' }
              }
            }
          },
          '400': {
            description: 'Invalid query parameters.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '401': {
            description:
              'Invalid API key (only when an Authorization: Bearer tn_live_* header is provided).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '429': {
            description: 'Too many requests.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/v1/weekly': {
      get: {
        tags: ['Weekly'],
        operationId: 'listWeeklyRoundups',
        summary: 'List weekly threat roundups',
        description: 'Returns published weekly roundups (TL;DR + date range).',
        'x-rateLimit': { key: 'ip', limit: 30, windowMs: 60000 },
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Page size. Default 20. Min 1, max 50.',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
          },
          {
            name: 'offset',
            in: 'query',
            required: false,
            description: 'Result offset for pagination. Default 0.',
            schema: { type: 'integer', minimum: 0, default: 0 }
          }
        ],
        responses: {
          '200': {
            description: 'A page of weekly roundups.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WeeklyResponse' }
              }
            }
          },
          '400': {
            description: 'Invalid query parameters (not expected for this endpoint).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '401': {
            description: 'Unauthorized (not expected for this endpoint).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '429': {
            description: 'Too many requests.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/v1/focus': {
      get: {
        tags: ['Focus'],
        operationId: 'listFocusItems',
        summary: 'List active focus items (advisories)',
        description: 'Returns active focus items. Filterable by severity.',
        'x-rateLimit': { key: 'ip', limit: 30, windowMs: 60000 },
        parameters: [
          {
            name: 'severity',
            in: 'query',
            required: false,
            description: 'Filter by severity.',
            schema: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Page size. Default 20. Min 1, max 50.',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
          },
          {
            name: 'offset',
            in: 'query',
            required: false,
            description: 'Result offset for pagination. Default 0.',
            schema: { type: 'integer', minimum: 0, default: 0 }
          }
        ],
        responses: {
          '200': {
            description: 'A page of focus items.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FocusResponse' }
              }
            }
          },
          '400': {
            description: 'Invalid severity.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '401': {
            description: 'Unauthorized (not expected for this endpoint).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '429': {
            description: 'Too many requests.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/v1/awareness': {
      get: {
        tags: ['Awareness'],
        operationId: 'listAwarenessLessons',
        summary: 'List awareness lessons',
        description: 'Returns published awareness lessons (title + excerpt). Supports title search.',
        'x-rateLimit': { key: 'ip', limit: 30, windowMs: 60000 },
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: false,
            description: 'Search by title (max 200 chars). HTML is stripped server-side.',
            schema: { type: 'string', minLength: 1, maxLength: 200 }
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Page size. Default 20. Min 1, max 50.',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
          },
          {
            name: 'offset',
            in: 'query',
            required: false,
            description: 'Result offset for pagination. Default 0.',
            schema: { type: 'integer', minimum: 0, default: 0 }
          }
        ],
        responses: {
          '200': {
            description: 'A page of awareness lessons.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AwarenessResponse' }
              }
            }
          },
          '400': {
            description: 'Invalid query.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '401': {
            description: 'Unauthorized (not expected for this endpoint).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '429': {
            description: 'Too many requests.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        operationId: 'listNotifications',
        summary: 'Fetch notification items for an API subscriber',
        description:
          'Authenticated via `key` query param (subscriber API key). Returns notification items for pending/sent notifications.',
        security: [{ notificationsKey: [] }],
        'x-rateLimit': { key: 'key', limit: 60, windowMs: 60000 },
        parameters: [
          {
            name: 'key',
            in: 'query',
            required: true,
            description: 'Subscriber API key for the notifications channel.',
            schema: { type: 'string', minLength: 1 }
          },
          {
            name: 'since',
            in: 'query',
            required: false,
            description:
              'Only return notifications for articles published at or after this date-time (ISO 8601).',
            schema: { type: 'string', format: 'date-time' }
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Max items to return. Default 50. Min 1, max 50.',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 50 }
          }
        ],
        responses: {
          '200': {
            description: 'Notification items.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotificationsResponse' }
              }
            }
          },
          '400': {
            description: 'Invalid `since` date.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '401': {
            description: 'Missing or invalid key.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '429': {
            description: 'Too many requests.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },

    '/api/v1/submit': {
      post: {
        tags: ['Submit'],
        operationId: 'submitArticle',
        summary: 'Submit an article URL to ThreatNoir',
        description:
          'Submit an article URL for ingestion. Requires an API key (Authorization: Bearer ... or x-api-key). Duplicate URLs return 409 with the existing article record.',
        security: [{ bearerAuth: [] }, { xApiKeyAuth: [] }],
        'x-rateLimit': { key: 'ip', limit: 10, windowMs: 60000 },
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SubmitRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Created (submitted).',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubmitResponse' }
              }
            }
          },
          '400': {
            description: 'Invalid input (missing/invalid url, invalid category, etc).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '401': {
            description: 'Unauthorized (missing/invalid API key).',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          },
          '409': {
            description: 'Conflict (URL already exists).',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SubmitResponse' }
              }
            }
          },
          '429': {
            description: 'Too many requests.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'API key in format: tn_live_...'
      },
      xApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key sent via x-api-key header.'
      },
      notificationsKey: {
        type: 'apiKey',
        in: 'query',
        name: 'key',
        description: 'Subscriber API key for /api/v1/notifications.'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        description:
          'Error response shape from the Nuxt/H3 error handler. Additional fields may be present.',
        additionalProperties: true,
        properties: {
          statusCode: { type: 'integer' },
          statusMessage: { type: 'string' },
          message: { type: 'string' }
        }
      },

      Category: {
        type: 'object',
        additionalProperties: true,
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          icon: { anyOf: [{ type: 'string' }, { type: 'null' }] }
        },
        required: ['id', 'name', 'slug']
      },

      Source: {
        type: 'object',
        additionalProperties: true,
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          url: { anyOf: [{ type: 'string' }, { type: 'null' }] }
        },
        required: ['id', 'name']
      },

      Tag: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          slug: { type: 'string' },
          name: { type: 'string' }
        },
        required: ['id', 'slug', 'name']
      },

      Article: {
        type: 'object',
        additionalProperties: true,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          url: { type: 'string' },
          summary: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          ai_summary: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          parent_article_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          relation_type: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          image_url: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          verify_count: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
          avg_score: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          score_count: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
          published_at: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
          ingested_at: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
          source: { anyOf: [{ $ref: '#/components/schemas/Source' }, { type: 'null' }] },
          category: { anyOf: [{ $ref: '#/components/schemas/Category' }, { type: 'null' }] },
          tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
          ioc_count: { type: 'integer', minimum: 0 }
        },
        required: ['id', 'title', 'url', 'tags', 'ioc_count']
      },

      ArticlesResponse: {
        type: 'object',
        additionalProperties: false,
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/Article' } },
          nextOffset: { type: 'integer', minimum: 0 },
          hasMore: { type: 'boolean' }
        },
        required: ['items', 'nextOffset', 'hasMore']
      },

      IocArticleRef: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          url: { type: 'string' },
          published_at: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] }
        },
        required: ['id', 'title', 'url', 'published_at']
      },

      Ioc: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string' },
          value: { type: 'string' },
          context: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          article: { $ref: '#/components/schemas/IocArticleRef' }
        },
        required: ['type', 'value', 'context', 'article']
      },

      IocsResponse: {
        type: 'object',
        additionalProperties: false,
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/Ioc' } },
          hasMore: { type: 'boolean' },
          nextOffset: { type: 'integer', minimum: 0 }
        },
        required: ['items', 'hasMore', 'nextOffset']
      },

      WeeklyItem: {
        type: 'object',
        additionalProperties: false,
        properties: {
          week_label: { type: 'string' },
          slug: { type: 'string' },
          tldr: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          date_from: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
          date_to: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
          published_at: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] }
        },
        required: ['week_label', 'slug', 'tldr', 'date_from', 'date_to', 'published_at']
      },

      WeeklyResponse: {
        type: 'object',
        additionalProperties: false,
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/WeeklyItem' } },
          nextOffset: { type: 'integer', minimum: 0 },
          hasMore: { type: 'boolean' }
        },
        required: ['items', 'nextOffset', 'hasMore']
      },

      FocusItem: {
        type: 'object',
        additionalProperties: true,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          slug: { type: 'string' },
          summary: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          category: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          cve_ids: {
            anyOf: [
              { type: 'array', items: { type: 'string' } },
              { type: 'string' },
              { type: 'null' }
            ]
          },
          affected_products: {
            anyOf: [
              { type: 'array', items: { type: 'string' } },
              { type: 'string' },
              { type: 'null' }
            ]
          },
          action_required: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          created_at: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
          expires_at: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] }
        },
        required: ['id', 'title', 'slug', 'severity']
      },

      FocusResponse: {
        type: 'object',
        additionalProperties: false,
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/FocusItem' } },
          nextOffset: { type: 'integer', minimum: 0 },
          hasMore: { type: 'boolean' }
        },
        required: ['items', 'nextOffset', 'hasMore']
      },

      AwarenessItem: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          slug: { type: 'string' },
          excerpt: { type: 'string' },
          created_at: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] }
        },
        required: ['title', 'slug', 'excerpt', 'created_at']
      },

      AwarenessResponse: {
        type: 'object',
        additionalProperties: false,
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/AwarenessItem' } },
          nextOffset: { type: 'integer', minimum: 0 },
          hasMore: { type: 'boolean' }
        },
        required: ['items', 'nextOffset', 'hasMore']
      },

      NotificationItem: {
        type: 'object',
        additionalProperties: false,
        properties: {
          article_id: { type: 'string' },
          title: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          brief: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          url: { type: 'string' },
          regulation: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          jurisdiction: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          fine_amount: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          published_at: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
          matched_at: { type: 'string', format: 'date-time' }
        },
        required: ['article_id', 'title', 'brief', 'url', 'regulation', 'jurisdiction', 'fine_amount', 'published_at', 'matched_at']
      },

      NotificationsResponse: {
        type: 'object',
        additionalProperties: false,
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/NotificationItem' } },
          count: { type: 'integer', minimum: 0 }
        },
        required: ['items', 'count']
      },

      SubmitRequest: {
        type: 'object',
        additionalProperties: false,
        properties: {
          url: { type: 'string', description: 'Article URL (http/https).' },
          title: { type: 'string', description: 'Optional title override.' },
          summary: { type: 'string', description: 'Optional summary override.' },
          category: {
            type: 'string',
            description: 'Optional category slug (lowercase letters, numbers, hyphens).',
            pattern: '^[a-z0-9-]+$'
          },
          source_name: { type: 'string', description: 'Optional display name for the source.' },
          auto_approve: {
            type: 'boolean',
            description: 'Request auto-approve (only honored for admin-scoped keys).'
          }
        },
        required: ['url']
      },

      SubmitResponse: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
          title: { type: 'string' },
          url: { type: 'string' }
        },
        required: ['id', 'status', 'title', 'url']
      }
    }
  }
} as const
