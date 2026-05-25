import { defineEventHandler, setResponseHeader } from 'h3'
import { openapiSpec } from '../utils/openapi-spec'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  return openapiSpec
})
