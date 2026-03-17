"""Structured genome schema — GenomeGraph.

This module defines a rich, graph-oriented representation of an application
genome.  It is additive to the existing flat GenomeDocument and does NOT
replace it.  The two schemas can coexist: GenomeDocument remains the
backward-compatible format; GenomeGraph is the forward-looking structured
format that supports field-to-object binding, typed relationships with
cardinality, and workflow step decomposition.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class GenomeField(BaseModel):
    """A single field/variable belonging to a specific object."""

    id: str
    name: str
    object_name: str
    type: str = ""
    required: bool = False
    reference: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class GenomeRelationship(BaseModel):
    """A directed edge between two objects."""

    id: str
    source_object: str
    target_object: str
    relationship_type: str = "reference"
    cardinality: str = "1:N"


class GenomeWorkflow(BaseModel):
    """A named workflow with an optional trigger and ordered steps."""

    id: str
    name: str
    trigger: str = ""
    steps: list[str] = Field(default_factory=list)


class GenomeObject(BaseModel):
    """A top-level entity (table, catalog item, form, etc.) with its fields
    and links to workflows and relationships by ID."""

    id: str
    name: str
    type: str = "table"
    fields: list[GenomeField] = Field(default_factory=list)
    workflows: list[str] = Field(default_factory=list)
    relationships: list[str] = Field(default_factory=list)


class GenomeGraph(BaseModel):
    """Graph-oriented genome representation.

    Objects own their fields directly.  Workflows and relationships are
    stored at the top level and referenced by ID from the objects that
    participate in them.
    """

    objects: list[GenomeObject] = Field(default_factory=list)
    workflows: list[GenomeWorkflow] = Field(default_factory=list)
    relationships: list[GenomeRelationship] = Field(default_factory=list)
