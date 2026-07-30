from docx.text.paragraph import Paragraph
from docx.table import Table

def iter_block_items(doc):
    """
    Yield each Paragraph or Table element in document order.
    """
    parent = doc.element.body
    for child in parent.iterchildren():
        if child.tag.endswith('p'):
            yield Paragraph(child, doc)
        elif child.tag.endswith('tbl'):
            yield Table(child, doc)
        # Any other block items (e.g. sections, drawing, etc.) can be ignored
