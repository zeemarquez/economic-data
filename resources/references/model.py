import numpy as np
import pandas as pd

from typing import Callable, Union
from functools import lru_cache
from pydantic import BaseModel, PrivateAttr
from dataclasses import dataclass
import inspect
from typing import Any

def table_format(x:float):
    if abs(x)< 0.1:
        return "-"
    else:
        decimals = 1 if abs(round(x, 0) - x) > 0.1 else 0
        if x < 0:
            return f"({abs(x):,.{decimals}f})"
        else:
            return f"{x:,.{decimals}f}" 

def bool_format(x:bool):
    if x:
        return "TRUE"
    return "FALSE" 
                
def label_format(label:str):
    replace_map = {
        'bop':'BoP',
        'eop':'EoP',
        'real': '(real)',
        'nominal': '(nominal)',
        'inf': '(real)',
        'tin': 'TIN'
    }
    label_split = label.split('_')
    for i, word in enumerate(label_split):
        label_split[i] = replace_map.get(word, word)
    label_split[0] = label_split[0].capitalize()
    return ' '.join(label_split)

class Styles:
    default = "background-color: #ffffff; color: #000000;"
    default_alternate = "background-color: #ededed; color: #000000;"

    highlight_1 = "background-color: #b5b5b5; font-weight: bold; color: #000000;"

    bool_true = "background-color: #008a25; color: #000000;"
    bool_false = "background-color: #cc0000; color: #000000;"

    column_headers = "background-color: #1f2937; color: #f3f4f6; font-weight: bold; padding: 10px;"
    index_headers = "background-color: #1f2937; color: #f3f4f6; font-weight: bold; padding: 10px; vertical-align: top; border-top: 2px solid #000000;"
    blank_headers = "background-color: #1f2937;"


class Formats:
    default = 'default'
    percentage = 'percentage'
    boolean = 'boolean'
    

class FormulaRow:
    count = 0
    def __init__(self, formula: Callable[["FormulaRow", int], float], initial: float|None = None, group:str = None, highlight:bool = False, format:str = Formats.default):
        self.group = group
        self.highlight = highlight
        self.format = format
        self.id = self.count
        FormulaRow.count += 1
        self.initial = initial
        # Wrap the lambda in lru_cache right at creation
        self.formula = lru_cache(maxsize=None)(formula)

    def __call__(self, t: int) -> float:
        if (self.initial is not None) and (t == 0):
            return self.initial
        # The lambda handles the recursion, lru_cache handles the performance
        return self.formula(self, t)
    
    def clear(self):
        # Built-in way to wipe an lru_cache
        self.formula.cache_clear()

    # --- Math Operations ---
    def __add__(self, other: Union["FormulaRow", int, float]):
        return FormulaRow(lambda row, t: self(t) + (other(t) if isinstance(other, FormulaRow) else other), group=self.group)
    
    def __sub__(self, other: Union["FormulaRow", int, float]):
        return FormulaRow(lambda row, t: self(t) - (other(t) if isinstance(other, FormulaRow) else other), group=self.group)

    def __mul__(self, other: Union["FormulaRow", int, float]):
        return FormulaRow(lambda row, t: self(t) * (other(t) if isinstance(other, FormulaRow) else other), group=self.group)

    def __truediv__(self, other: Union["FormulaRow", int, float]):
        return FormulaRow(lambda row, t: self(t) / (other(t) if isinstance(other, FormulaRow) else other), group=self.group)
    
    def __radd__(self, other): return self.__add__(other)
    def __rmul__(self, other): return self.__mul__(other)

    def __rsub__(self, other):
        return FormulaRow(lambda row, t: - self(t) + (other(t) if isinstance(other, FormulaRow) else other), group=self.group)

class SimpleRow(FormulaRow):
    def __init__(self, value, group:str = None, highlight:str = None, format:str = Formats.default):
        self.group = group
        self.highlight = highlight
        self.format = format
        self.id = self.count
        FormulaRow.count += 1
        self.initial = value
        formula: Callable[["FormulaRow", int], float] = lambda self, t : value
        # Wrap the lambda in lru_cache right at creation
        self.formula = lru_cache(maxsize=None)(formula)

class RowData:
    def __init__(self, name:str, row:FormulaRow):
        self.name = name
        self.row = row
        self.id = row.id
        self.values:dict[int, float] = {}

    def calculate_values(self, periods:int):
        self.values = {}
        self.row.clear()
        for t in range(periods):
            self.values[t] = self.row(t)

        return self.values

class Model():

    __protected_attrnames = ['periods', 'initial_period', 'group_label', '__protected_attrnames', 'row_index', 'ordered_rows']

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)
        self.group_label = None
        self.row_index = 0
        self.ordered_rows:list[dict] = []
        self.periods = 5
        self.initial_period = 2025

    def __setattr__(self, name, value):
        if isinstance(value, FormulaRow):
            value:FormulaRow
            if name in Model.__protected_attrnames:
                raise ValueError(f"Attribute name cannot be any of: {', '.join(Model.__protected_attrnames)}")
            else:
                if self.group_label is not None:
                    value.group = self.group_label
                super().__setattr__(name, value)
                self.ordered_rows.append((name, value, self.row_index))
                self.row_index += 1
        else:
            super().__setattr__(name, value)

    def set_group(self, group_label:str):
        self.group_label = group_label

    def reset_group(self):
        self.group_label = None

    def period(self, t):
        return self.initial_period + t
    
    def get_rows(self) -> dict[str, FormulaRow]:
        return {name:row for name, row, index in self.ordered_rows}

    def get_data(self) -> list[RowData]:
        rows = self.get_rows()
        rows_data = [RowData(name, row) for name, row in rows.items()]
        for row in rows_data:
            row.calculate_values(self.periods)

        return rows_data
    
    def df(self):
        rows_data = self.get_data()
        df_data = []
        category_label = "Categoria"
        name_label = "Concepto"

        for row in rows_data:
            category = row.row.group if row.row.group is not None else ""
            _data = {name_label:row.name, category_label:category}
            for t, value in row.values.items():
                _data[str(t + self.initial_period)] = value
            df_data.append(_data)

        df = pd.DataFrame(df_data)
        df = df.set_index([category_label, name_label])
        #df = df.sort_index()
        df.columns = df.columns.astype(int)
        
        return df
    
    def show(self):
        df = self.df()
        rows = self.get_rows()

        percentage_rows = [name for name, row in rows.items() if row.format == Formats.percentage]
        boolean_rows = [name for name, row in rows.items() if row.format == Formats.boolean]

        rows_to_highlight = {name for name, row in rows.items() if row.highlight}   # set is faster + cleaner

        idx_rows_to_highlight = []
        for i, row in enumerate(df.iloc):
            if row.name[1] in rows_to_highlight:
                idx_rows_to_highlight.append(i)

        def apply_row_styles(row:pd.Series):
            # Get the integer position of the row
            idx = df.index.get_loc(row.name)
            # Check for Highlight
            border_style = ""
            if idx > 0:
                if row.name[0] != df.iloc[idx-1].name[0]:
                    border_style = "border-top: 2px solid #000000;"

            if row.name[1] in boolean_rows:
                styles = []
                for val in row.values:
                    if val:
                        style = Styles.bool_true + border_style
                    else:
                        style = Styles.bool_false + border_style
                    styles.append(style)
                return styles
                        
            if row.name[1] in rows_to_highlight:
                style = Styles.highlight_1
            elif idx % 2 == 0:
                style = Styles.default_alternate
            else:
                style = Styles.default
                
            return [style + border_style] * len(row)

        def apply_index1_styles(index_data):
            text_align = "text-align: left;"
            styles = []
            for i, label in enumerate(index_data):
                style = Styles.default

                if i in idx_rows_to_highlight:
                    style = Styles.highlight_1
                elif i % 2 == 0:
                    style = Styles.default_alternate
                else:
                    style = Styles.default
                
                if i > 0:
                    if df.iloc[i].name[0] != df.iloc[i-1].name[0]:
                        style += "border-top: 2px solid #000000;"
                styles.append(style + text_align)
            return styles
        
        # Apply both
        df_style = (df.style
            .format(table_format)
            .format("{:.1%}", 
                subset=pd.IndexSlice[pd.IndexSlice[:, percentage_rows], :])
            .format(bool_format, 
                subset=pd.IndexSlice[pd.IndexSlice[:, boolean_rows], :])
            .set_properties(**{'font-style': 'italic'}, 
                subset=pd.IndexSlice[pd.IndexSlice[:, percentage_rows], :])
            .apply(apply_row_styles, axis=1)
            .apply_index(apply_index1_styles, axis=0, level=1)
            .set_table_styles([
                {"selector": "th.level0", "props":Styles.index_headers},
                # Column headers (years)
                {"selector": "th.col_heading", "props": Styles.column_headers},

                # Index names
                {"selector": "th.index_name", "props": Styles.column_headers},
                
                # Blank top-left
                {"selector": ".blank", "props": Styles.blank_headers},
            ])
            .format_index(
                label_format,                   # your custom logic here
                axis=0, 
                level=1                                       # only level 1 ("Concepto")
            )
        )


        return df_style
    
    def to_html(self, filepath:str):
        styled = self.show()
        styled.set_table_styles([
            {
                'selector': 'th, td', 
                'props': [('font-family', 'Verdana, Geneva, sans-serif'), ('font-size', '8px'), ('border', 'none'), ('padding', '2px')]
            },
            {
                'selector': '', # Targets the <table> tag itself
                'props': [('border-collapse', 'collapse'), ('border', 'none'), ('padding', '0px')]
            },
        ], overwrite=False)
        html = styled.to_html(filepath)
        return html
    




