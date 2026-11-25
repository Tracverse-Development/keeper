# Lessons

### LES-001 — Working Memory scopes every query to one Knowledge Asset (2026-11-25)
- **Context:** Forgetting a fact writes a `desk:Retraction` KA; the first `FACTS` query left retracted facts out with `FILTER NOT EXISTS { ?r desk:retracts ?f }`. On the real node (10.0.26) the retracted fact still came back. A direct join (`?r desk:retracts ?f . ?f schema:text ?t`) returned nothing, and `MINUS` kept everything.
- **Lesson:** In Working Memory each KA is its own scope: patterns that span two assets match nothing, so filters across assets silently pass everything. A mocked client could never show this (LES-011 in umoja-ark).
- **Rule added:** Every query reads one class; joins across records happen in Rust (`memory::Memory::facts` filters retractions). The query test fails on `NOT EXISTS` or `MINUS`. Prove every new query on the real node before it ships.
