import io
import json
import sys

MAX_ROWS = 10000
MAX_COLUMNS = 64
MAX_PAGES = 50


def spreadsheet(data):
    from openpyxl import load_workbook

    workbook = load_workbook(data, read_only=True, data_only=True, keep_links=False)
    try:
        result = []
        for sheet in workbook:
            sheet.reset_dimensions()
            rows = []
            for row in sheet.iter_rows(max_col=MAX_COLUMNS, values_only=True):
                if len(rows) >= MAX_ROWS:
                    raise ValueError("Too many spreadsheet rows")
                rows.append(list(row))
            result.append({"name": sheet.title, "rows": rows})
        return result
    finally:
        workbook.close()


def pdf(data):
    import pdfplumber

    with pdfplumber.open(data) as document:
        if len(document.pages) > MAX_PAGES:
            raise ValueError("Too many PDF pages")
        return [
            {"name": str(page.page_number), "rows": table}
            for page in document.pages
            for table in page.extract_tables()
        ]


if __name__ == "__main__":
    try:
        extract = {"xlsx": spreadsheet, "pdf": pdf}[sys.argv[1]]
        result = extract(io.BytesIO(sys.stdin.buffer.read()))
        sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False, default=str).encode("utf-8"))
    except Exception:
        sys.exit("Document extraction failed. Check the file and Python dependencies.")
