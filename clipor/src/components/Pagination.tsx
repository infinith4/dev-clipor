import { useTranslation } from "react-i18next";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPrevious: () => void;
  onNext: () => void;
}

function Pagination({ page, totalPages, totalItems, onPrevious, onNext }: PaginationProps) {
  const { t } = useTranslation();
  return (
    <div className="pagination">
      <button type="button" onClick={onPrevious} disabled={page <= 1}>
        &lt;
      </button>
      <div className="pagination-status">
        <strong>{page}</strong>
        <span>/ {totalPages}</span>
        <small>({totalItems}{t("pagination.items_suffix")})</small>
      </div>
      <button type="button" onClick={onNext} disabled={page >= totalPages}>
        &gt;
      </button>
    </div>
  );
}

export default Pagination;
