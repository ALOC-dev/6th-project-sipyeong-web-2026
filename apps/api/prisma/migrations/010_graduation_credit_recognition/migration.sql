BEGIN;

CREATE TABLE graduation_credit_policies (
  department_id integer PRIMARY KEY REFERENCES departments(department_id),
  max_liberal_credits numeric(5,1) NOT NULL CHECK (max_liberal_credits > 0),
  source_url text NOT NULL CHECK (source_url LIKE 'https://%')
);

-- UOS academic affairs: engineering is subject to the general 48-credit cap.
INSERT INTO graduation_credit_policies (department_id, max_liberal_credits, source_url)
SELECT department_id, 48, 'https://www.uos.ac.kr/kor/html/uaInfo/result/order/order.do?identified=anonymous'
FROM departments
WHERE department_id = 34 AND department_name = '컴퓨터과학부';

COMMIT;
