import type { UploadSession } from "../uploads/types";

interface TablePreviewProps {
  session: UploadSession;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Empty";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export default function TablePreview({ session }: TablePreviewProps) {
  return (
    <section className="table-card">
      <div className="table-card-heading">
        <div>
          <p className="eyebrow">Source data</p>
          <h4>Table preview</h4>
        </div>
        <span>First {session.preview_rows.length} rows · scroll sideways</span>
      </div>
      <div className="table-scroll">
        <table aria-label="Spreadsheet preview">
          <thead>
            <tr>
              <th scope="col">#</th>
              {session.columns.map((column) => (
                <th key={column.id} scope="col">
                  <span>{column.name || `Unnamed column ${column.position + 1}`}</span>
                  <small>{column.inferred_type}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {session.preview_rows.map((row) => (
              <tr key={row.row_number}>
                <th scope="row">{row.row_number}</th>
                {session.columns.map((column) => {
                  const value = displayValue(row.values[column.id]);
                  return (
                    <td className={value === "Empty" ? "empty-cell" : undefined} key={column.id}>
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
