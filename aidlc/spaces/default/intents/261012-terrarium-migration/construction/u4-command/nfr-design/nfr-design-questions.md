# command安全性設計の確認

## Questions

人間に新しく選んでもらう事項はない。上限、予約、取消、timeout、表示はC02/C04/C05/C11、U4機能設計（Q1–Q4=A）とNFR要件（NFR2.1–8.2）に従う。機能設計とNFR要件のレビューで後工程扱いにしたMinor指摘（lsの並べ替え、取消、timeout、commandId、予約名、孤立surrogate、UI条件の受渡し、browser版の記録）は、ここで具体的な設計に落とす。十分性は実測で確認する。

## Assumptions & Open Questions

None.
