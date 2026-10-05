"""Providers package for Kaitoon Web Reader.
Rule R-02 Compliance: Absolutely no em dashes or en dashes allowed.
"""

from kaitoon.providers.komiku import KomikuClient

__all__ = ["KomikuClient"]
