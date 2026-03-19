interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPrevious: () => void;
  onNext: () => void;
}

function Pagination({ page, totalPages, totalItems, onPrevious, onNext }: PaginationProps) {
  return (
    <div className="pagination">
      <button type="button" onClick={onPrevious} disabled={page <= 1}>
        &lt;
      </button>
      <div className="pagination-status">
        <strong>{page}</strong>
        <span>/ {totalPages}</span>
        <small>({totalItems}件)</small>
      </div>
      <button type="button" onClick={onNext} disabled={page >= totalPages}>
        &gt;
      </button>
    </div>
  );
}

export default Pagination;
